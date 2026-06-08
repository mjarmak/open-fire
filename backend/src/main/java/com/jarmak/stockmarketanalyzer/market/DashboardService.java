package com.jarmak.stockmarketanalyzer.market;

import com.jarmak.stockmarketanalyzer.alerts.StockAlertService;
import com.jarmak.stockmarketanalyzer.config.AppProperties;
import com.jarmak.stockmarketanalyzer.config.CacheConfig;
import com.jarmak.stockmarketanalyzer.market.MarketModels.DashboardResponse;
import com.jarmak.stockmarketanalyzer.market.MarketModels.IndicatorSnapshot;
import com.jarmak.stockmarketanalyzer.market.MarketModels.NotificationStatus;
import com.jarmak.stockmarketanalyzer.market.MarketModels.PortfolioHolding;
import com.jarmak.stockmarketanalyzer.market.MarketModels.StockAlert;
import com.jarmak.stockmarketanalyzer.notification.TelegramNotificationService;
import com.jarmak.stockmarketanalyzer.portfolio.PortfolioService;
import com.jarmak.stockmarketanalyzer.security.UserAccountService;
import com.jarmak.stockmarketanalyzer.security.UserAccountService.UserRetirementSettings;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class DashboardService {
  private static final Logger LOGGER = LoggerFactory.getLogger(DashboardService.class);
  private static final String BELGIUM_TIME_ZONE = "Europe/Brussels";
  private static final BigDecimal DEFAULT_DESIRED_MONTHLY_INCOME = BigDecimal.valueOf(5000);
  private static final BigDecimal DEFAULT_MONTHLY_SAVINGS = BigDecimal.valueOf(500);
  private static final BigDecimal DEFAULT_OTHER_SAVINGS = BigDecimal.valueOf(10000);
  private static final BigDecimal DEFAULT_YEARLY_INFLATION_RATE = BigDecimal.valueOf(3);
  private static final BigDecimal DEFAULT_CUSTOM_RETURN_RATE = BigDecimal.valueOf(12);
  private static final BigDecimal DEFAULT_SAFE_WITHDRAWAL_RATE = BigDecimal.valueOf(4);
  private static final int MAX_RETIREMENT_PROJECTION_YEARS = 80;
  private static final int ALERT_NOTIFICATION_COOLDOWN_DAYS = 7;

  private final AppProperties properties;
  private final MarketIndicatorService marketIndicatorService;
  private final StockAlertService stockAlertService;
  private final TelegramNotificationService telegramNotificationService;
  private final PortfolioService portfolioService;
  private final UserAccountService userAccountService;

  public DashboardService(
      AppProperties properties,
      MarketIndicatorService marketIndicatorService,
      StockAlertService stockAlertService,
      TelegramNotificationService telegramNotificationService,
      PortfolioService portfolioService,
      UserAccountService userAccountService
  ) {
    this.properties = properties;
    this.marketIndicatorService = marketIndicatorService;
    this.stockAlertService = stockAlertService;
    this.telegramNotificationService = telegramNotificationService;
    this.portfolioService = portfolioService;
    this.userAccountService = userAccountService;
  }

  public DashboardResponse dashboard() {
    List<IndicatorSnapshot> indicators = indicators();
    List<StockAlert> stocks = stocks();
    List<PortfolioHolding> portfolio = portfolio();
    return new DashboardResponse(
        Instant.now(),
        indicators,
        stocks,
        portfolio,
        dailyReport(indicators, stocks),
        notificationStatus()
    );
  }

  public List<IndicatorSnapshot> indicators() {
    return marketIndicatorService.indicators();
  }

  @Cacheable(cacheNames = CacheConfig.STOCK_ALERTS_CACHE, key = "T(org.springframework.security.core.context.SecurityContextHolder).context.authentication.name")
  public List<StockAlert> stocks() {
    return List.copyOf(stockAlertService.evaluateWatchedStocks(null));
  }

  public List<PortfolioHolding> portfolio() {
    return portfolioService.holdings();
  }

  public NotificationStatus notificationStatus() {
    boolean telegramEnabled = properties.telegram() != null && properties.telegram().enabled();
    boolean telegramConfigured = telegramNotificationService.configured();

    return new NotificationStatus(
        telegramEnabled,
        telegramConfigured,
        telegramNotificationService.providerName()
    );
  }

  private String formatDecimal(BigDecimal value) {
    if (value == null) {
      return "-";
    }
    return value.setScale(2, java.math.RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
  }

  private String dailyReport(List<IndicatorSnapshot> indicators, List<StockAlert> stocks) {
    if (indicators.isEmpty() && stocks.isEmpty()) {
      return "No live market data is available yet. Add manual portfolio positions and configure provider keys to fetch market data.";
    }

    String riskTone = indicators.stream()
        .filter(indicator -> List.of("risk", "fear").contains(indicator.status()))
        .findFirst()
        .map(indicator -> "Risk is elevated because " + indicator.name() + " is flashing " + indicator.status() + ".")
        .orElse(indicators.isEmpty()
            ? "Macro indicators are unavailable because no live provider data was returned."
            : "Risk tone is balanced; no fetched macro indicator is in a full risk state.");

    String breadth = indicators.stream()
        .filter(indicator -> "breadth".equals(indicator.id()))
        .findFirst()
        .map(indicator -> " Breadth sits at " + formatDecimal(indicator.value()) + indicator.unit() + ", so participation is " + indicator.status() + ".")
        .orElse("");

    long alertCount = stocks.stream().filter(StockAlert::alert).count();
    String alerts = stocks.isEmpty()
        ? " No fetched portfolio stock data is available."
        : alertCount > 0
        ? " " + alertCount + " watched stock alert(s) need review before any trade."
        : " No watched stock alerts fired.";

    return riskTone + breadth + alerts;
  }

  private String escapeHtml(String text) {
    if (text == null) {
      return "";
    }
    return text.replace("&", "&amp;")
               .replace("<", "&lt;")
               .replace(">", "&gt;");
  }

  private boolean isImportant(String word) {
    if (word == null || word.isEmpty()) {
      return false;
    }
    
    // Clean word for checking (remove trailing/leading punctuation, symbols)
    String clean = word.replaceAll("^[^a-zA-Z0-9$%-]+|[^a-zA-Z0-9$%-]+$", "");
    if (clean.isEmpty()) {
      return false;
    }
    
    // Check if it's a number, percentage, or currency
    if (clean.matches(".*\\d+.*")) {
      return true;
    }
    
    // Check if it's all uppercase (like stock symbols or status codes)
    if (clean.matches("[A-Z]{1,6}")) {
      return true;
    }
    
    // Set of important words (lowercase for case-insensitive check)
    String lower = clean.toLowerCase();
    return lower.equals("risk") || lower.equals("fear") || lower.equals("calm") ||
           lower.equals("supportive") || lower.equals("greed") || lower.equals("watch") ||
           lower.equals("alert") || lower.equals("elevated") || lower.equals("balanced") ||
           lower.equals("high") || lower.equals("low") || lower.equals("review") ||
           lower.equals("active") || lower.equals("quiet") || lower.equals("warning") ||
           lower.equals("price") || lower.equals("average") || lower.equals("cost") ||
           lower.equals("vix") || lower.equals("score") || lower.equals("reason") ||
           lower.equals("macro") || lower.equals("indicator") || lower.equals("indicators") ||
           lower.equals("portfolio") || lower.equals("market") || lower.equals("analyzer") ||
           lower.equals("briefing") || lower.equals("target") || lower.equals("fund") ||
           lower.equals("assets") || lower.equals("return") || lower.equals("cagr") ||
           lower.equals("attention") || lower.equals("fired") || lower.equals("failed") ||
           lower.equals("blocked");
  }

  private String formatSegment(String text) {
    if (text == null || text.isEmpty()) {
      return "";
    }
    
    StringBuilder sb = new StringBuilder();
    java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("([a-zA-Z0-9$%,.%/-]+)|([^a-zA-Z0-9$%,.%/-]+)");
    java.util.regex.Matcher matcher = pattern.matcher(text);
    
    while (matcher.find()) {
      String token = matcher.group();
      if (matcher.group(1) != null) {
        String escapedToken = escapeHtml(token);
        if (isImportant(token)) {
          sb.append("<b>").append(escapedToken).append("</b>");
        } else {
          sb.append(escapedToken);
        }
      } else {
        sb.append(escapeHtml(token));
      }
    }
    return sb.toString();
  }

  public String generateBriefingForUser(String username) {
    return buildBriefingForUser(username).message();
  }

  private ScheduledTelegramMessage buildBriefingForUser(String username) {
    List<IndicatorSnapshot> indicators = marketIndicatorService.indicators();
    BigDecimal vixFearIndex = indicators.stream()
        .filter(indicator -> "vix".equals(indicator.id()))
        .findFirst()
        .map(IndicatorSnapshot::value)
        .orElse(null);
    List<StockAlert> stocks = stockAlertService.evaluateWatchedStocksForUser(username, vixFearIndex);
    Set<String> recentlyAlertedSymbols = portfolioService.recentlyAlertedSymbolsForUser(
        username,
        Instant.now().minus(ALERT_NOTIFICATION_COOLDOWN_DAYS, ChronoUnit.DAYS)
    );
    List<StockAlert> alertStocks = stocks.stream()
        .filter(StockAlert::alert)
        .toList();
    List<StockAlert> includedAlertStocks = alertStocks.stream()
        .filter(stock -> !recentlyAlertedSymbols.contains(normalizeSymbol(stock.symbol())))
        .toList();
    Set<String> includedAlertSymbols = includedAlertStocks.stream()
        .map(stock -> normalizeSymbol(stock.symbol()))
        .collect(java.util.stream.Collectors.toSet());

    StringBuilder sb = new StringBuilder();
    sb.append("📊 ").append(formatSegment("OpenFIRE - Risk & Alert Briefing")).append("\n");
    sb.append("⏰ ").append(formatSegment("Generated: " + java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(java.time.ZoneId.systemDefault()).format(Instant.now()))).append("\n\n");

    // 1. Macro Indicators Section
    sb.append("🔍 ").append(formatSegment("MACRO MARKET INDICATORS:")).append("\n");
    if (indicators.isEmpty()) {
      sb.append("⚠️ ").append(formatSegment("No live macro indicators available.")).append("\n");
    } else {
      for (IndicatorSnapshot ind : indicators) {
        String statusIcon = "⚪";
        if ("risk".equalsIgnoreCase(ind.status()) || "fear".equalsIgnoreCase(ind.status())) {
          statusIcon = "🔴";
        } else if ("watch".equalsIgnoreCase(ind.status())) {
          statusIcon = "🟡";
        } else if ("calm".equalsIgnoreCase(ind.status()) || "supportive".equalsIgnoreCase(ind.status()) || "greed".equalsIgnoreCase(ind.status())) {
          statusIcon = "🟢";
        }
        
        sb.append(statusIcon).append(" ").append(formatSegment(ind.name() + ": " + formatDecimal(ind.value()) + " " + ind.unit() + " (Status: " + ind.status().toUpperCase() + ")")).append("\n");
      }
    }
    sb.append("\n");

    // 2. Risk Tone Summary
    sb.append("📝 ").append(formatSegment("RISK SUMMARY:")).append("\n");
    sb.append(formatSegment(dailyReport(indicators, stocks))).append("\n\n");

    // 3. Stock Alerts Section
    sb.append("⚠️ ").append(formatSegment("PORTFOLIO ALERTS & RISKS:")).append("\n");
    long alertCount = includedAlertStocks.size();
    if (stocks.isEmpty()) {
      sb.append("💼 ").append(formatSegment("Your portfolio is empty. Add stocks in the dashboard to monitor their risk.")).append("\n");
    } else if (alertCount == 0 && !alertStocks.isEmpty()) {
      sb.append(formatSegment("No new watched stock alerts. Active repeated symbols are muted for 7 days after they are sent.")).append("\n");
    } else if (alertCount == 0) {
      sb.append("🟢 ").append(formatSegment("All quiet. No watched stock alerts are currently active.")).append("\n");
    } else {
      sb.append("🚨 ").append(formatSegment("The following " + alertCount + " stock(s) require review:")).append("\n");
      for (StockAlert stock : stocks) {
        if (includedAlertSymbols.contains(normalizeSymbol(stock.symbol()))) {
          sb.append("\n• ").append(formatSegment(stock.symbol() + " (" + stock.companyName() + ")")).append("\n");
          sb.append("  ").append(formatSegment("Type: " + stock.positionType())).append("\n");
          if (stock.latestPrice() != null) {
            String priceLine = stock.watchOnly()
                ? "Price: $" + formatDecimal(stock.latestPrice()) + " | Watch only"
                : "Price: $" + formatDecimal(stock.latestPrice()) + " | Avg Cost: $" + formatDecimal(stock.averageCost());
            sb.append("  ").append(formatSegment(priceLine)).append("\n");
          }
          if (stock.fearScore() != null) {
            sb.append("  ").append(formatSegment("Fear Score: " + formatDecimal(stock.fearScore()) + "/100")).append("\n");
          }
          sb.append("  ").append(formatSegment("Reason: " + stock.reason())).append("\n");
        }
      }
    }

    return new ScheduledTelegramMessage(sb.toString(), List.copyOf(includedAlertSymbols));
  }

  @Scheduled(cron = "0 0 16 * * *", zone = BELGIUM_TIME_ZONE)
  public void sendDcaReminder() {
    sendScheduledTelegramMessage("DCA reminder", username -> new ScheduledTelegramMessage(generateDcaReminderForUser(username), List.of()));
  }

  @Scheduled(cron = "0 0 16,23 * * *", zone = BELGIUM_TIME_ZONE)
  public void sendDailyBriefing() {
    sendScheduledTelegramMessage("11 PM Belgium time risk and alert briefing", this::buildBriefingForUser);
  }

  private void sendScheduledTelegramMessage(String description, Function<String, ScheduledTelegramMessage> messageFactory) {
    boolean telegramEnabled = properties.telegram() != null && properties.telegram().enabled();
    if (!telegramEnabled) {
      return;
    }

    LOGGER.info("Starting scheduled {}...", description);
    Map<String, UserAccountService.UserTelegramSchedule> userSettings = "DCA reminder".equals(description)
        ? userAccountService.allUserTelegramSettingsForDcaEnabled()
        : userAccountService.allUserTelegramSettings();
    if (userSettings.isEmpty()) {
      LOGGER.info("No active users found with configured Telegram chat IDs. Skipping scheduled {}.", description);
      return;
    }

    String today = currentBelgiumDayCode();
    for (Map.Entry<String, UserAccountService.UserTelegramSchedule> entry : userSettings.entrySet()) {
      String username = entry.getKey();
      UserAccountService.UserTelegramSchedule schedule = entry.getValue();
      if (!schedule.days().contains(today)) {
        LOGGER.info("Skipping scheduled {} for user {} because {} is not selected.", description, username, today);
        continue;
      }

      String chatId = schedule.chatId();
      LOGGER.info("Sending scheduled {} to user: {} (ChatID: {})", description, username, chatId);
      try {
        ScheduledTelegramMessage message = messageFactory.apply(username);
        TelegramNotificationService.NotificationResult result = telegramNotificationService.sendToChat(chatId, message.message());
        if (result.sent()) {
          portfolioService.markAlertsSentForUser(username, message.cooldownSymbols(), Instant.now());
        }
      } catch (Exception exception) {
        LOGGER.error("Failed to send scheduled {} to user {}: {}", description, username, exception.getMessage(), exception);
      }
    }
  }

  private String currentBelgiumDayCode() {
    return LocalDate.now(ZoneId.of(BELGIUM_TIME_ZONE))
        .getDayOfWeek()
        .name()
        .substring(0, 3);
  }

  public String generateDcaReminderForUser(String username) {
    UserRetirementSettings settings = userAccountService.getRetirementSettingsForUser(username);
    UserAccountService.UserDcaSettings dcaSettings = userAccountService.getDcaSettingsForUser(username);
    BigDecimal desiredMonthlyIncome = positiveOrDefault(settings.desiredMonthlyIncome(), DEFAULT_DESIRED_MONTHLY_INCOME);
    BigDecimal monthlyContribution = zeroOrPositive(settings.monthlySavings(), DEFAULT_MONTHLY_SAVINGS);
    BigDecimal otherSavings = zeroOrPositive(settings.otherSavings(), DEFAULT_OTHER_SAVINGS);
    BigDecimal yearlyInflationRate = defaultIfNull(settings.yearlyInflationRate(), DEFAULT_YEARLY_INFLATION_RATE);
    BigDecimal customReturnRate = defaultIfNull(settings.customReturnRate(), DEFAULT_CUSTOM_RETURN_RATE);
    BigDecimal safeWithdrawalRate = positiveOrDefault(settings.safeWithdrawalRate(), DEFAULT_SAFE_WITHDRAWAL_RATE);

    BigDecimal currentAssets = currentRetirementAssets(username, otherSavings);
    BigDecimal targetFund = retirementTarget(desiredMonthlyIncome, safeWithdrawalRate);
    BigDecimal moneyNeeded = targetFund.subtract(currentAssets).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    String yearsToRetire = yearsToRetire(
        currentAssets,
        monthlyContribution,
        customReturnRate,
        yearlyInflationRate,
        desiredMonthlyIncome,
        safeWithdrawalRate
    );

    String reminderIntro = StringUtils.hasText(dcaSettings.reminderNote())
        ? "<b>Your DCA focus:</b> " + escapeHtml(dcaSettings.reminderNote()) + "\n\n"
        : "";

    return ("""
        %s
        <b>DCA reminder</b>
        It is 4 PM in Belgium. Time to add your planned contribution.

        <b>Planned DCA:</b> %s/month
        <b>Current retirement assets:</b> %s
        <b>Retirement target:</b> %s using %s%% SWR
        <b>More money needed to retire:</b> %s
        <b>Estimated time to retire:</b> %s

        Assumes %s%% annual return, %s%% inflation, and your saved retirement settings.
        """).formatted(
        reminderIntro,
        formatMoney(monthlyContribution),
        formatMoney(currentAssets),
        formatMoney(targetFund),
        formatPercent(safeWithdrawalRate),
        formatMoney(moneyNeeded),
        yearsToRetire,
        formatPercent(customReturnRate),
        formatPercent(yearlyInflationRate)
    );
  }

  private BigDecimal currentRetirementAssets(String username, BigDecimal fallbackOtherSavings) {
    try {
      List<StockAlert> stocks = stockAlertService.evaluateWatchedStocksForUser(username, null);
      if (!stocks.isEmpty()) {
        BigDecimal investedAssets = stocks.stream()
            .filter(stock -> !stock.watchOnly())
            .map(stock -> stock.marketValue() != null ? stock.marketValue() : stock.costBasis())
            .filter(value -> value != null && value.signum() > 0)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .setScale(2, RoundingMode.HALF_UP);
        if (investedAssets.signum() > 0) {
          return investedAssets;
        }
      }
    } catch (RuntimeException exception) {
      LOGGER.warn("Could not evaluate live portfolio value for DCA reminder user {}. Falling back to saved holdings.", username, exception);
      BigDecimal holdingsCost = portfolioService.holdingsForUser(username).stream()
          .filter(holding -> !holding.watchOnly())
          .map(holding -> holding.quantity().multiply(holding.averageCost()))
          .reduce(BigDecimal.ZERO, BigDecimal::add);
      if (holdingsCost.signum() > 0) {
        return holdingsCost.setScale(2, RoundingMode.HALF_UP);
      }
    }
    return fallbackOtherSavings.setScale(2, RoundingMode.HALF_UP);
  }

  private BigDecimal retirementTarget(BigDecimal desiredMonthlyIncome, BigDecimal safeWithdrawalRatePercent) {
    BigDecimal annualIncome = desiredMonthlyIncome.multiply(BigDecimal.valueOf(12));
    BigDecimal safeWithdrawalRate = safeWithdrawalRatePercent.divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);
    return annualIncome.divide(safeWithdrawalRate, 2, RoundingMode.HALF_UP);
  }

  private String yearsToRetire(
      BigDecimal currentAssets,
      BigDecimal monthlyContribution,
      BigDecimal annualReturnPercent,
      BigDecimal yearlyInflationRate,
      BigDecimal desiredMonthlyIncome,
      BigDecimal safeWithdrawalRate
  ) {
    if (currentAssets.compareTo(retirementTarget(desiredMonthlyIncome, safeWithdrawalRate)) >= 0) {
      return "ready now";
    }

    double balance = currentAssets.doubleValue();
    double monthlyContributionValue = monthlyContribution.doubleValue();
    double monthlyReturn = annualReturnPercent.divide(BigDecimal.valueOf(100), 10, RoundingMode.HALF_UP).doubleValue() / 12;
    double yearlyInflation = yearlyInflationRate.divide(BigDecimal.valueOf(100), 10, RoundingMode.HALF_UP).doubleValue();
    for (int month = 1; month <= MAX_RETIREMENT_PROJECTION_YEARS * 12; month++) {
      balance = Math.max(0, balance * (1 + monthlyReturn) + monthlyContributionValue);
      double years = month / 12.0;
      BigDecimal target = retirementTargetWithInflation(desiredMonthlyIncome, safeWithdrawalRate, yearlyInflation, years);
      if (BigDecimal.valueOf(balance).compareTo(target) >= 0) {
        return formatYears(years);
      }
    }
    return "more than " + MAX_RETIREMENT_PROJECTION_YEARS + " years";
  }

  private BigDecimal retirementTargetWithInflation(BigDecimal desiredMonthlyIncome, BigDecimal safeWithdrawalRatePercent, double yearlyInflation, double years) {
    BigDecimal monthlyIncome = desiredMonthlyIncome.multiply(BigDecimal.valueOf(Math.pow(Math.max(0.01, 1 + yearlyInflation), Math.max(0, years))));
    BigDecimal annualIncome = monthlyIncome.multiply(BigDecimal.valueOf(12));
    BigDecimal safeWithdrawalRate = safeWithdrawalRatePercent.divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);
    return annualIncome.divide(safeWithdrawalRate, 2, RoundingMode.HALF_UP);
  }

  private BigDecimal positiveOrDefault(BigDecimal value, BigDecimal fallback) {
    return value == null || value.signum() <= 0 ? fallback : value;
  }

  private BigDecimal zeroOrPositive(BigDecimal value, BigDecimal fallback) {
    return value == null || value.signum() < 0 ? fallback : value;
  }

  private BigDecimal defaultIfNull(BigDecimal value, BigDecimal fallback) {
    return value == null ? fallback : value;
  }

  private String formatMoney(BigDecimal value) {
    NumberFormat formatter = NumberFormat.getCurrencyInstance(Locale.US);
    formatter.setMaximumFractionDigits(0);
    return formatter.format(value.setScale(0, RoundingMode.HALF_UP));
  }

  private String formatPercent(BigDecimal value) {
    return value.setScale(2, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
  }

  private String formatYears(double years) {
    if (years < 1) {
      int months = Math.max(1, (int) Math.ceil(years * 12));
      return months + (months == 1 ? " month" : " months");
    }
    BigDecimal rounded = BigDecimal.valueOf(years).setScale(1, RoundingMode.HALF_UP).stripTrailingZeros();
    return rounded.toPlainString() + (rounded.compareTo(BigDecimal.ONE) == 0 ? " year" : " years");
  }

  private String normalizeSymbol(String symbol) {
    return symbol == null ? "" : symbol.trim().toUpperCase(Locale.ROOT);
  }

  private record ScheduledTelegramMessage(String message, List<String> cooldownSymbols) {
  }

  public String currentUsername() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    return authentication == null ? "anonymous" : authentication.getName();
  }
}
