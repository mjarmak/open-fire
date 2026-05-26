package com.jarmak.stockmarketanalyzer.config;

import com.jarmak.stockmarketanalyzer.database.DatabaseService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import java.sql.Connection;
import java.sql.Statement;

@Component
public class DatabaseConnectionCleaner {
  private static final Logger LOGGER = LoggerFactory.getLogger(DatabaseConnectionCleaner.class);
  private final DatabaseService databaseService;

  public DatabaseConnectionCleaner(DatabaseService databaseService) {
    this.databaseService = databaseService;
  }

  @EventListener(ApplicationReadyEvent.class)
  public void cleanOtherConnections() {
    LOGGER.info("Cleaning up other active PostgreSQL connections for this database...");
    
    // Terminate all sessions connected to this database except for the current session
    String sql = "SELECT pg_terminate_backend(pid) " +
                 "FROM pg_stat_activity " +
                 "WHERE datname = current_database() " +
                 "AND pid <> pg_backend_pid()";

    try (
        Connection connection = databaseService.connection();
        Statement statement = connection.createStatement()
    ) {
      statement.execute(sql);
      LOGGER.info("Other database connections successfully terminated.");
    } catch (Exception e) {
      LOGGER.warn("Could not clean up other active connections (normal if database user is not owner/superuser): {}", e.getMessage());
    }
  }
}
