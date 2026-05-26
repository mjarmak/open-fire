package com.jarmak.stockmarketanalyzer.database;

import com.jarmak.stockmarketanalyzer.config.AppProperties;
import jakarta.annotation.PostConstruct;
import java.util.Map;
import org.flywaydb.core.Flyway;
import org.springframework.stereotype.Service;

@Service
public class DatabaseMigrationService {
  private final AppProperties properties;

  public DatabaseMigrationService(AppProperties properties, DatabaseService databaseService) {
    this.properties = properties;
  }

  @PostConstruct
  void migrate() {
    AppProperties.Database database = properties.database();
    Flyway.configure()
        .dataSource(database.url(), database.username(), database.password())
        .locations("classpath:db/migration")
        .baselineOnMigrate(true)
        .baselineVersion("0")
        .placeholders(Map.of(
            "defaultUsername", sqlLiteral(properties.security().username()),
            "defaultPasswordHash", sqlLiteral(properties.security().passwordHash())
        ))
        .load()
        .migrate();
  }

  private String sqlLiteral(String value) {
    return value == null ? "" : value.replace("'", "''");
  }
}
