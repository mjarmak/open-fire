package com.jarmak.stockmarketanalyzer.database;

import com.jarmak.stockmarketanalyzer.config.AppProperties;
import jakarta.annotation.PostConstruct;
import java.util.Map;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.configuration.FluentConfiguration;
import org.springframework.stereotype.Service;

@Service
public class DatabaseMigrationService {
  private final AppProperties properties;

  public DatabaseMigrationService(AppProperties properties, DatabaseService databaseService) {
    this.properties = properties;
  }

  @PostConstruct
  void migrate() {
    configuration().load().migrate();
  }

  FluentConfiguration configuration() {
    AppProperties.Database database = properties.database();
    return Flyway.configure()
        .dataSource(database.url(), database.username(), database.password())
        // Concurrent index builds must not wait on Flyway's own coordinating transaction.
        .configuration(Map.of("flyway.postgresql.transactional.lock", "false"))
        .locations("classpath:db/migration")
        .baselineOnMigrate(true)
        .baselineVersion("0")
        .placeholders(Map.of(
            "defaultUsername", sqlLiteral(properties.security().username()),
            "defaultPasswordHash", sqlLiteral(properties.security().passwordHash())
        ));
  }

  private String sqlLiteral(String value) {
    return value == null ? "" : value.replace("'", "''");
  }
}
