package com.jarmak.stockmarketanalyzer.security;

import com.jarmak.stockmarketanalyzer.config.AppProperties;
import com.jarmak.stockmarketanalyzer.database.DatabaseService;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

public class DatabaseUserDetailsService implements UserDetailsService {
  private final AppProperties properties;
  private final DatabaseService databaseService;
  private volatile boolean initialized = false;

  public DatabaseUserDetailsService(AppProperties properties, DatabaseService databaseService) {
    this.properties = properties;
    this.databaseService = databaseService;
  }

  @Override
  public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
    initialize();
    try (
        Connection connection = databaseService.connection();
        PreparedStatement statement = connection.prepareStatement("""
            select username, password_hash, enabled
            from users
            where lower(username) = lower(?)
            """)
    ) {
      statement.setString(1, username);
      try (ResultSet results = statement.executeQuery()) {
        if (!results.next() || !results.getBoolean("enabled")) {
          throw new UsernameNotFoundException("User not found.");
        }

        return User
            .withUsername(results.getString("username"))
            .password(results.getString("password_hash"))
            .passwordEncoder(password -> password)
            .roles("USER")
            .build();
      }
    } catch (SQLException exception) {
      throw new UsernameNotFoundException("Could not load user from Postgres.", exception);
    }
  }

  private void initialize() {
    if (initialized) {
      return;
    }

    synchronized (this) {
      if (initialized) {
        return;
      }

      try (
          Connection connection = databaseService.connection()
      ) {
        seedConfiguredUser(connection);
        initialized = true;
      } catch (SQLException exception) {
        throw new IllegalStateException("Could not seed configured Postgres user.", exception);
      }
    }
  }

  private void seedConfiguredUser(Connection connection) throws SQLException {
    try (PreparedStatement statement = connection.prepareStatement("""
        insert into users (username, password_hash, enabled, updated_at)
        values (?, ?, true, now())
        on conflict (username) do nothing
        """)) {
      statement.setString(1, properties.security().username());
      statement.setString(2, properties.security().passwordHash());
      statement.executeUpdate();
    }
  }
}
