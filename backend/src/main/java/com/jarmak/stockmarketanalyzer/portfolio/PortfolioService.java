package com.jarmak.stockmarketanalyzer.portfolio;

import com.jarmak.stockmarketanalyzer.database.DatabaseService;
import com.jarmak.stockmarketanalyzer.config.CacheConfig;
import com.jarmak.stockmarketanalyzer.market.MarketModels.PortfolioHolding;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class PortfolioService {
  private final DatabaseService databaseService;

  public PortfolioService(DatabaseService databaseService) {
    this.databaseService = databaseService;
  }

  public List<PortfolioHolding> holdings() {
    return postgresHoldings();
  }

  @CacheEvict(cacheNames = CacheConfig.STOCK_ALERTS_CACHE, key = "T(org.springframework.security.core.context.SecurityContextHolder).context.authentication.name")
  public PortfolioHolding upsert(String symbol, String companyName, BigDecimal quantity, BigDecimal averageCost) {
    return upsert(symbol, companyName, quantity, averageCost, false);
  }

  @CacheEvict(cacheNames = CacheConfig.STOCK_ALERTS_CACHE, key = "T(org.springframework.security.core.context.SecurityContextHolder).context.authentication.name")
  public PortfolioHolding upsert(String symbol, String companyName, BigDecimal quantity, BigDecimal averageCost, boolean watchOnly) {
    return postgresInsert(validHolding(null, symbol, companyName, quantity, averageCost, watchOnly));
  }

  @CacheEvict(cacheNames = CacheConfig.STOCK_ALERTS_CACHE, key = "T(org.springframework.security.core.context.SecurityContextHolder).context.authentication.name")
  public PortfolioHolding update(long id, String symbol, String companyName, BigDecimal quantity, BigDecimal averageCost, boolean watchOnly) {
    if (id <= 0) {
      throw new IllegalArgumentException("Position id is required.");
    }
    return postgresUpdate(validHolding(id, symbol, companyName, quantity, averageCost, watchOnly));
  }

  private PortfolioHolding validHolding(Long id, String symbol, String companyName, BigDecimal quantity, BigDecimal averageCost, boolean watchOnly) {
    String normalizedSymbol = normalizeSymbol(symbol);
    if (!StringUtils.hasText(normalizedSymbol)) {
      throw new IllegalArgumentException("Symbol is required.");
    }
    BigDecimal savedQuantity = watchOnly ? BigDecimal.ZERO : quantity;
    BigDecimal savedAverageCost = watchOnly ? BigDecimal.ZERO : averageCost;
    if (!watchOnly && (savedQuantity == null || savedQuantity.signum() <= 0)) {
      throw new IllegalArgumentException("Quantity must be greater than zero.");
    }
    if (!watchOnly && (savedAverageCost == null || savedAverageCost.signum() < 0)) {
      throw new IllegalArgumentException("Average cost must be zero or greater.");
    }

    return new PortfolioHolding(
        id,
        normalizedSymbol,
        StringUtils.hasText(companyName) ? companyName.trim() : normalizedSymbol,
        savedQuantity,
        savedAverageCost,
        watchOnly
    );
  }

  @CacheEvict(cacheNames = CacheConfig.STOCK_ALERTS_CACHE, key = "T(org.springframework.security.core.context.SecurityContextHolder).context.authentication.name")
  public void delete(long id) {
    if (id <= 0) {
      throw new IllegalArgumentException("Position id is required.");
    }
    postgresDelete(id);
  }

  private String normalizeSymbol(String symbol) {
    if (!StringUtils.hasText(symbol)) {
      return "";
    }
    return symbol.trim().toUpperCase(Locale.ROOT);
  }

  public List<PortfolioHolding> holdingsForUser(String username) {
    try (
        Connection connection = connection();
        PreparedStatement statement = connection.prepareStatement(
            "select id, symbol, company_name, quantity, average_cost, watch_only from portfolio_holdings where username = ? order by watch_only, symbol, id"
        )
    ) {
      statement.setString(1, username);
      try (ResultSet results = statement.executeQuery()) {
        List<PortfolioHolding> rows = new ArrayList<>();
        while (results.next()) {
          rows.add(new PortfolioHolding(
              results.getLong("id"),
              results.getString("symbol"),
              results.getString("company_name"),
              results.getBigDecimal("quantity"),
              results.getBigDecimal("average_cost"),
              results.getBoolean("watch_only")
          ));
        }
        return rows;
      }
    } catch (SQLException exception) {
      throw new IllegalStateException("Could not load portfolio holdings from Postgres.", exception);
    }
  }

  public Set<String> recentlyAlertedSymbolsForUser(String username, Instant since) {
    try (
        Connection connection = connection();
        PreparedStatement statement = connection.prepareStatement("""
            select symbol
            from portfolio_holdings
            where username = ? and last_alert_sent_at >= ?
            """)
    ) {
      statement.setString(1, username);
      statement.setTimestamp(2, Timestamp.from(since));
      try (ResultSet results = statement.executeQuery()) {
        Set<String> symbols = new java.util.HashSet<>();
        while (results.next()) {
          symbols.add(normalizeSymbol(results.getString("symbol")));
        }
        return symbols;
      }
    } catch (SQLException exception) {
      throw new IllegalStateException("Could not load recently alerted portfolio symbols.", exception);
    }
  }

  public void markAlertsSentForUser(String username, Collection<String> symbols, Instant sentAt) {
    Set<String> normalizedSymbols = symbols.stream()
        .map(this::normalizeSymbol)
        .filter(StringUtils::hasText)
        .collect(Collectors.toSet());
    if (normalizedSymbols.isEmpty()) {
      return;
    }

    try (
        Connection connection = connection();
        PreparedStatement statement = connection.prepareStatement("""
            update portfolio_holdings
            set last_alert_sent_at = ?
            where username = ? and symbol = ?
            """)
    ) {
      for (String symbol : normalizedSymbols) {
        statement.setTimestamp(1, Timestamp.from(sentAt));
        statement.setString(2, username);
        statement.setString(3, symbol);
        statement.addBatch();
      }
      statement.executeBatch();
    } catch (SQLException exception) {
      throw new IllegalStateException("Could not update portfolio alert notification timestamps.", exception);
    }
  }

  private List<PortfolioHolding> postgresHoldings() {
    return holdingsForUser(currentUsername());
  }

  private PortfolioHolding postgresInsert(PortfolioHolding holding) {
    try (
        Connection connection = connection();
        PreparedStatement statement = connection.prepareStatement("""
            insert into portfolio_holdings (username, symbol, company_name, quantity, average_cost, watch_only, updated_at)
            values (?, ?, ?, ?, ?, ?, now())
            returning id
            """)
    ) {
      statement.setString(1, currentUsername());
      statement.setString(2, holding.symbol());
      statement.setString(3, holding.companyName());
      statement.setBigDecimal(4, holding.quantity());
      statement.setBigDecimal(5, holding.averageCost());
      statement.setBoolean(6, holding.watchOnly());
      try (ResultSet results = statement.executeQuery()) {
        if (results.next()) {
          return new PortfolioHolding(
              results.getLong("id"),
              holding.symbol(),
              holding.companyName(),
              holding.quantity(),
              holding.averageCost(),
              holding.watchOnly()
          );
        }
      }
      throw new IllegalStateException("Could not save portfolio holding to Postgres.");
    } catch (SQLException exception) {
      throw new IllegalStateException("Could not save portfolio holding to Postgres.", exception);
    }
  }

  private PortfolioHolding postgresUpdate(PortfolioHolding holding) {
    try (
        Connection connection = connection();
        PreparedStatement statement = connection.prepareStatement("""
            update portfolio_holdings
            set symbol = ?,
                company_name = ?,
                quantity = ?,
                average_cost = ?,
                watch_only = ?,
                updated_at = now()
            where username = ? and id = ?
            """)
    ) {
      statement.setString(1, holding.symbol());
      statement.setString(2, holding.companyName());
      statement.setBigDecimal(3, holding.quantity());
      statement.setBigDecimal(4, holding.averageCost());
      statement.setBoolean(5, holding.watchOnly());
      statement.setString(6, currentUsername());
      statement.setLong(7, holding.id());
      int updated = statement.executeUpdate();
      if (updated == 0) {
        throw new IllegalArgumentException("Portfolio position was not found.");
      }
      return holding;
    } catch (SQLException exception) {
      throw new IllegalStateException("Could not update portfolio holding in Postgres.", exception);
    }
  }

  private void postgresDelete(long id) {
    try (
        Connection connection = connection();
        PreparedStatement statement = connection.prepareStatement("delete from portfolio_holdings where username = ? and id = ?")
    ) {
      statement.setString(1, currentUsername());
      statement.setLong(2, id);
      statement.executeUpdate();
    } catch (SQLException exception) {
      throw new IllegalStateException("Could not delete portfolio holding from Postgres.", exception);
    }
  }

  private Connection connection() throws SQLException {
    return databaseService.connection();
  }

  private String currentUsername() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null || !StringUtils.hasText(authentication.getName())) {
      throw new IllegalStateException("Authenticated user is required for Postgres portfolio access.");
    }
    return authentication.getName();
  }
}
