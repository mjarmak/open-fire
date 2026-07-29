package com.jarmak.stockmarketanalyzer.security;

import com.jarmak.stockmarketanalyzer.database.DatabaseService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JeniusUserProvisioningFilter extends OncePerRequestFilter {
  private final DatabaseService databaseService;

  public JeniusUserProvisioningFilter(DatabaseService databaseService) {
    this.databaseService = databaseService;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request,
      HttpServletResponse response,
      FilterChain filterChain
  ) throws ServletException, IOException {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication instanceof JwtAuthenticationToken jwt && authentication.isAuthenticated()) {
      provision(jwt.getName(), jwt.getToken().getSubject());
    }
    filterChain.doFilter(request, response);
  }

  private void provision(String username, String subject) throws ServletException {
    if (!StringUtils.hasText(username) || !StringUtils.hasText(subject)) {
      throw new ServletException("Jenius access token is missing its user identity.");
    }
    try (
        Connection connection = databaseService.connection();
        PreparedStatement statement = connection.prepareStatement("""
            insert into users (username, password_hash, enabled, oidc_subject, updated_at)
            values (?, '', true, ?, now())
            on conflict (username) do update
            set oidc_subject = excluded.oidc_subject,
                enabled = true,
                updated_at = now()
            where users.oidc_subject is null or users.oidc_subject = excluded.oidc_subject
            """)
    ) {
      statement.setString(1, username);
      statement.setString(2, subject);
      if (statement.executeUpdate() == 0) {
        throw new ServletException("This Open Fire username is linked to another Jenius account.");
      }
    } catch (SQLException exception) {
      throw new ServletException("Could not provision the Jenius user in Open Fire.", exception);
    }
  }
}
