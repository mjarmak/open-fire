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
      provision(jwt.getName(), jwt.getToken().getSubject(), jwt.getToken().getClaimAsString("email"),
          Boolean.TRUE.equals(jwt.getToken().getClaimAsBoolean("email_verified")),
          request.getRequestURI().endsWith("/users/me/dca"));
    }
    filterChain.doFilter(request, response);
  }

  private void provision(String username, String subject, String email, boolean verified, boolean visit) throws ServletException {
    if (!StringUtils.hasText(username) || !StringUtils.hasText(subject)) {
      throw new ServletException("Jenius access token is missing its user identity.");
    }
    try (
        Connection connection = databaseService.connection();
        PreparedStatement statement = connection.prepareStatement("""
            insert into users (username, password_hash, enabled, oidc_subject, email_address, email_verified, last_app_visit, updated_at)
            values (?, '', true, ?, ?, ?, case when ? then now() else null end, now())
            on conflict (username) do update
            set oidc_subject = excluded.oidc_subject,
                enabled = true,
                email_address = excluded.email_address,
                email_verified = excluded.email_verified,
                last_app_visit = coalesce(excluded.last_app_visit, users.last_app_visit),
                updated_at = now()
            where users.oidc_subject is null or users.oidc_subject = excluded.oidc_subject
            """)
    ) {
      statement.setString(1, username);
      statement.setString(2, subject);
      statement.setString(3, email);
      statement.setBoolean(4, verified);
      statement.setBoolean(5, visit);
      if (statement.executeUpdate() == 0) {
        throw new ServletException("This Open Fire username is linked to another Jenius account.");
      }
    } catch (SQLException exception) {
      throw new ServletException("Could not provision the Jenius user in Open Fire.", exception);
    }
  }
}
