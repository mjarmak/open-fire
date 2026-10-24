package com.jarmak.stockmarketanalyzer.database;

import static org.assertj.core.api.Assertions.assertThat;

import com.jarmak.stockmarketanalyzer.config.AppProperties;
import java.util.Properties;
import org.flywaydb.database.postgresql.PostgreSQLConfigurationExtension;
import org.junit.jupiter.api.Test;

class DatabaseMigrationServiceTest {
  @Test void usesSessionAdvisoryLocksWithoutDisablingTransactionalMigrations() {
    var properties = new AppProperties(new AppProperties.Security("test", "salt", "unused"), null,
        new AppProperties.Database("jdbc:postgresql://127.0.0.1:1/unused", "test", "test"), null, null);
    var configuration = new DatabaseMigrationService(properties, null).configuration();
    assertThat(configuration.getPluginRegister().getPlugin(PostgreSQLConfigurationExtension.class).isTransactionalLock()).isFalse();
    assertThat(configuration.isExecuteInTransaction()).isTrue();
  }

  @Test void concurrentIndexMigrationIsExplicitlyNonTransactional() throws Exception {
    var properties = new Properties();
    try (var stream = getClass().getResourceAsStream("/db/migration/V16__index_database_filter_paths.sql.conf")) {
      assertThat(stream).isNotNull();
      properties.load(stream);
    }
    assertThat(properties.getProperty("executeInTransaction")).isEqualTo("false");
  }
}
