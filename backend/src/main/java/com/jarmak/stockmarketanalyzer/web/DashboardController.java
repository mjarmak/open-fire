package com.jarmak.stockmarketanalyzer.web;

import com.jarmak.stockmarketanalyzer.alerts.StockAlertService;
import com.jarmak.stockmarketanalyzer.market.DashboardService;
import com.jarmak.stockmarketanalyzer.market.FinnhubClient;
import com.jarmak.stockmarketanalyzer.market.MarketModels.DashboardResponse;
import com.jarmak.stockmarketanalyzer.market.MarketModels.IndicatorSnapshot;
import com.jarmak.stockmarketanalyzer.market.MarketModels.NotificationStatus;
import com.jarmak.stockmarketanalyzer.market.MarketModels.PortfolioHolding;
import com.jarmak.stockmarketanalyzer.market.MarketModels.StockAlert;
import com.jarmak.stockmarketanalyzer.market.MarketModels.SymbolSearchResult;
import com.jarmak.stockmarketanalyzer.notification.TelegramNotificationService;
import com.jarmak.stockmarketanalyzer.portfolio.PortfolioService;
import com.jarmak.stockmarketanalyzer.security.UserAccountService;
import com.jarmak.stockmarketanalyzer.security.UserAccountService.DuplicateUsernameException;
import com.jarmak.stockmarketanalyzer.security.UserAccountService.UserDcaSettings;
import com.jarmak.stockmarketanalyzer.security.UserAccountService.UserRegistrationUnavailableException;
import com.jarmak.stockmarketanalyzer.security.UserAccountService.UserTelegramSettings;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.util.StringUtils;

@RestController
@RequestMapping("/api")
public class DashboardController {
  private final DashboardService dashboardService;
  private final TelegramNotificationService telegramNotificationService;
  private final PortfolioService portfolioService;
  private final FinnhubClient finnhubClient;
  private final UserAccountService userAccountService;
  private final StockAlertService stockAlertService;

  public DashboardController(
      DashboardService dashboardService,
      TelegramNotificationService telegramNotificationService,
      PortfolioService portfolioService,
      FinnhubClient finnhubClient,
      UserAccountService userAccountService,
      StockAlertService stockAlertService
  ) {
    this.dashboardService = dashboardService;
    this.telegramNotificationService = telegramNotificationService;
    this.portfolioService = portfolioService;
    this.finnhubClient = finnhubClient;
    this.userAccountService = userAccountService;
    this.stockAlertService = stockAlertService;
  }

  @PostMapping({"/users", "/users/"})
  UserAccountResponse createUser(@Valid @RequestBody CreateUserRequest request) {
    try {
      UserAccountService.UserAccount user = userAccountService.createUser(request.username(), request.password());
      return new UserAccountResponse(user.username());
    } catch (DuplicateUsernameException exception) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, exception.getMessage(), exception);
    } catch (UserRegistrationUnavailableException exception) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, exception.getMessage(), exception);
    }
  }

  @GetMapping("/dashboard")
  DashboardResponse dashboard() {
    return dashboardService.dashboard();
  }

  @GetMapping("/indicators")
  List<IndicatorSnapshot> indicators() {
    return dashboardService.indicators();
  }

  @GetMapping("/stocks")
  List<StockAlert> stocks() {
    return dashboardService.stocks();
  }

  @GetMapping("/stocks/preview")
  StockAlert stockPreview(@RequestParam String symbol) {
    SymbolSearchResult match = finnhubClient.findExactSymbol(symbol)
        .orElseThrow(() -> new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Choose an existing stock from autocomplete before previewing it."
        ));
    return stockAlertService.preview(match.symbol(), match.name());
  }

  @GetMapping("/notifications/status")
  NotificationStatus notificationStatus() {
    return dashboardService.notificationStatus();
  }

  @GetMapping("/portfolio")
  List<PortfolioHolding> portfolio() {
    return portfolioService.holdings();
  }

  @GetMapping(value = "/portfolio/export", produces = "text/csv")
  ResponseEntity<String> exportPortfolio() {
    String csv = toCsv(dashboardService.stocks());
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"portfolio-positions.csv\"")
        .contentType(MediaType.parseMediaType("text/csv"))
        .body(csv);
  }

  @PostMapping(value = "/portfolio/import", consumes = "text/csv")
  PortfolioImportResponse importPortfolio(@RequestBody String csv) {
    try {
      int imported = 0;
      List<String> errors = new ArrayList<>();
      List<String> lines = csv == null ? List.of() : csv.lines().toList();

      for (int i = 0; i < lines.size(); i++) {
        String line = lines.get(i);
        if (!StringUtils.hasText(line)) {
          continue;
        }

        List<String> fields = parseCsvLine(line);
        if (i == 0 && !fields.isEmpty() && "symbol".equalsIgnoreCase(fields.get(0))) {
          continue;
        }

        if (fields.size() < 2) {
          errors.add("Line " + (i + 1) + " must have symbol and companyName.");
          continue;
        }

        try {
          boolean watchOnly = fields.size() > 4 && Boolean.parseBoolean(fields.get(4));
          portfolioService.upsert(
              fields.get(0),
              fields.get(1),
              decimalOrZero(fields, 2),
              decimalOrZero(fields, 3),
              watchOnly
          );
          imported++;
        } catch (RuntimeException exception) {
          errors.add("Line " + (i + 1) + ": " + exception.getMessage());
        }
      }

      return new PortfolioImportResponse(imported, errors);
    } catch (RuntimeException exception) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not import portfolio CSV.", exception);
    }
  }

  @PostMapping("/portfolio")
  PortfolioHolding saveHolding(@Valid @RequestBody PortfolioHoldingRequest request) {
    try {
      SymbolSearchResult symbol = finnhubClient.findExactSymbol(request.symbol())
          .orElseThrow(() -> new ResponseStatusException(
              HttpStatus.BAD_REQUEST,
              "Choose an existing stock from autocomplete before adding it."
          ));
      return portfolioService.upsert(symbol.symbol(), symbol.name(), request.quantity(), request.averageCost(), request.watchOnly());
    } catch (IllegalArgumentException exception) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, exception.getMessage(), exception);
    }
  }

  @PutMapping("/portfolio/{holdingId}")
  PortfolioHolding updateHolding(@PathVariable long holdingId, @Valid @RequestBody PortfolioHoldingRequest request) {
    try {
      SymbolSearchResult symbol = finnhubClient.findExactSymbol(request.symbol())
          .orElseThrow(() -> new ResponseStatusException(
              HttpStatus.BAD_REQUEST,
              "Choose an existing stock from autocomplete before saving it."
          ));
      return portfolioService.update(holdingId, symbol.symbol(), symbol.name(), request.quantity(), request.averageCost(), request.watchOnly());
    } catch (IllegalArgumentException exception) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, exception.getMessage(), exception);
    }
  }

  @DeleteMapping("/portfolio/{holdingId}")
  void deleteHolding(@PathVariable long holdingId) {
    portfolioService.delete(holdingId);
  }

  @GetMapping("/symbols/search")
  List<SymbolSearchResult> searchSymbols(
      @RequestParam String keywords,
      @RequestParam(defaultValue = "false") boolean includeIndicators
  ) {
    List<SymbolSearchResult> results = finnhubClient.searchSymbols(keywords);
    if (!includeIndicators) {
      return results;
    }

    return results.stream()
        .map(result -> new SymbolSearchResult(
            result.symbol(),
            result.name(),
            result.region(),
            result.currency(),
            previewOrNull(result)
        ))
        .toList();
  }

  @PostMapping("/notifications/telegram")
  TelegramSendResponse sendTelegram(@Valid @RequestBody TelegramSendRequest request) {
    TelegramNotificationService.NotificationResult result = telegramNotificationService.send(request.message());
    return new TelegramSendResponse(result.sent(), result.message(), result.missingChatId());
  }

  @GetMapping("/users/me/telegram")
  TelegramSettingsResponse telegramSettings() {
    return new TelegramSettingsResponse(userAccountService.currentTelegramChatId().orElse(""));
  }

  @PutMapping("/users/me/telegram")
  TelegramSettingsResponse updateTelegramSettings(@Valid @RequestBody TelegramSettingsRequest request) {
    UserTelegramSettings settings = userAccountService.updateCurrentTelegramChatId(request.chatId());
    return new TelegramSettingsResponse(settings.chatId());
  }

  @GetMapping("/users/me/dca")
  DcaSettingsResponse dcaSettings() {
    UserDcaSettings settings = userAccountService.currentDcaSettings();
    return new DcaSettingsResponse(settings.telegramDcaEnabled(), settings.reminderNote() == null ? "" : settings.reminderNote());
  }

  @PutMapping("/users/me/dca")
  DcaSettingsResponse updateDcaSettings(@Valid @RequestBody DcaSettingsRequest request) {
    UserDcaSettings settings = userAccountService.updateCurrentDcaSettings(
        new UserDcaSettings(request.telegramDcaEnabled(), request.reminderNote())
    );
    return new DcaSettingsResponse(settings.telegramDcaEnabled(), settings.reminderNote() == null ? "" : settings.reminderNote());
  }

  @GetMapping("/users/me/retirement")
  UserAccountService.UserRetirementSettings getRetirementSettings() {
    return userAccountService.getRetirementSettings();
  }

  @PutMapping("/users/me/retirement")
  UserAccountService.UserRetirementSettings updateRetirementSettings(@RequestBody UserAccountService.UserRetirementSettings settings) {
    return userAccountService.updateRetirementSettings(settings);
  }

  public record TelegramSendRequest(@NotBlank String message) {
  }

  public record TelegramSendResponse(boolean sent, String message, boolean missingChatId) {
  }

  public record TelegramSettingsRequest(@NotBlank String chatId) {
  }

  public record TelegramSettingsResponse(String chatId) {
  }

  public record DcaSettingsRequest(
      boolean telegramDcaEnabled,
      @Size(max = 800) String reminderNote
  ) {
  }

  public record DcaSettingsResponse(
      boolean telegramDcaEnabled,
      String reminderNote
  ) {
  }

  public record CreateUserRequest(
      @NotBlank @Size(min = 3, max = 64) @Pattern(regexp = "[A-Za-z0-9._-]+") String username,
      @NotBlank @Size(min = 8, max = 128) String password
  ) {
  }

  public record UserAccountResponse(String username) {
  }

  public record PortfolioImportResponse(int imported, List<String> errors) {
  }

  public record PortfolioHoldingRequest(
      @NotBlank String symbol,
      String companyName,
      @DecimalMin(value = "0.0") BigDecimal quantity,
      @DecimalMin(value = "0.0") BigDecimal averageCost,
      boolean watchOnly
  ) {
  }

  private StockAlert previewOrNull(SymbolSearchResult result) {
    try {
      return stockAlertService.preview(result.symbol(), result.name());
    } catch (RuntimeException exception) {
      return null;
    }
  }

  private String toCsv(List<StockAlert> stocks) {
    StringBuilder csv = new StringBuilder(
        "symbol,companyName,quantity,averageCost,watchOnly,latestPrice,peRatio,beta,realizedVolatilityPercent,drawdownPercent,fearScore,marketValue,costBasis,dayGainLoss,dayGainLossPercent,"
            + "unrealizedGainLoss,unrealizedGainLossPercent,marketCap,thirtyDayChangePercent,positionType,alert,reason\n"
    );
    for (StockAlert stock : stocks) {
      csv.append(csvValue(stock.symbol())).append(',')
          .append(csvValue(stock.companyName())).append(',')
          .append(csvValue(stock.quantity())).append(',')
          .append(csvValue(stock.averageCost())).append(',')
          .append(stock.watchOnly()).append(',')
          .append(csvValue(stock.latestPrice())).append(',')
          .append(csvValue(stock.peRatio())).append(',')
          .append(csvValue(stock.beta())).append(',')
          .append(csvValue(stock.realizedVolatilityPercent())).append(',')
          .append(csvValue(stock.drawdownPercent())).append(',')
          .append(csvValue(stock.fearScore())).append(',')
          .append(csvValue(stock.marketValue())).append(',')
          .append(csvValue(stock.costBasis())).append(',')
          .append(csvValue(stock.dayGainLoss())).append(',')
          .append(csvValue(stock.dayGainLossPercent())).append(',')
          .append(csvValue(stock.unrealizedGainLoss())).append(',')
          .append(csvValue(stock.unrealizedGainLossPercent())).append(',')
          .append(csvValue(stock.marketCap())).append(',')
          .append(csvValue(stock.thirtyDayChangePercent())).append(',')
          .append(csvValue(stock.positionType())).append(',')
          .append(stock.alert()).append(',')
          .append(csvValue(stock.reason())).append('\n');
    }
    return csv.toString();
  }

  private String csvValue(BigDecimal value) {
    return value == null ? "" : value.toPlainString();
  }

  private String csvValue(String value) {
    String safeValue = value == null ? "" : value;
    if (safeValue.contains(",") || safeValue.contains("\"") || safeValue.contains("\n") || safeValue.contains("\r")) {
      return "\"" + safeValue.replace("\"", "\"\"") + "\"";
    }
    return safeValue;
  }

  private BigDecimal decimalOrZero(List<String> fields, int index) {
    if (fields.size() <= index || !StringUtils.hasText(fields.get(index))) {
      return BigDecimal.ZERO;
    }
    return new BigDecimal(fields.get(index));
  }

  private List<String> parseCsvLine(String line) {
    List<String> fields = new ArrayList<>();
    StringBuilder field = new StringBuilder();
    boolean quoted = false;

    for (int i = 0; i < line.length(); i++) {
      char current = line.charAt(i);
      if (current == '"') {
        if (quoted && i + 1 < line.length() && line.charAt(i + 1) == '"') {
          field.append('"');
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (current == ',' && !quoted) {
        fields.add(field.toString().trim());
        field.setLength(0);
      } else {
        field.append(current);
      }
    }

    fields.add(field.toString().trim());
    return fields;
  }
}
