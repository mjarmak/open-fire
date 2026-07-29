package com.jarmak.stockmarketanalyzer.security;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.jarmak.stockmarketanalyzer.database.DatabaseService;
import jakarta.servlet.FilterChain;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

class JeniusUserProvisioningFilterTest {
  @AfterEach
  void clearSecurityContext() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void provisionsJeniusIdentityBeforeContinuingRequest() throws Exception {
    DatabaseService databaseService = mock(DatabaseService.class);
    Connection connection = mock(Connection.class);
    PreparedStatement statement = mock(PreparedStatement.class);
    FilterChain chain = mock(FilterChain.class);
    when(databaseService.connection()).thenReturn(connection);
    when(connection.prepareStatement(anyString())).thenReturn(statement);
    when(statement.executeUpdate()).thenReturn(1);
    SecurityContextHolder.getContext().setAuthentication(authentication("alice", "jenius-subject-1"));

    new JeniusUserProvisioningFilter(databaseService).doFilterInternal(
        new MockHttpServletRequest(), new MockHttpServletResponse(), chain);

    verify(statement).setString(1, "alice");
    verify(statement).setString(2, "jenius-subject-1");
    verify(chain).doFilter(
        org.mockito.ArgumentMatchers.any(MockHttpServletRequest.class),
        org.mockito.ArgumentMatchers.any(MockHttpServletResponse.class));
  }

  @Test
  void rejectsUsernameAlreadyLinkedToAnotherJeniusAccount() throws Exception {
    DatabaseService databaseService = mock(DatabaseService.class);
    Connection connection = mock(Connection.class);
    PreparedStatement statement = mock(PreparedStatement.class);
    when(databaseService.connection()).thenReturn(connection);
    when(connection.prepareStatement(anyString())).thenReturn(statement);
    when(statement.executeUpdate()).thenReturn(0);
    SecurityContextHolder.getContext().setAuthentication(authentication("alice", "different-subject"));

    JeniusUserProvisioningFilter filter = new JeniusUserProvisioningFilter(databaseService);

    assertThatThrownBy(() -> filter.doFilterInternal(
        new MockHttpServletRequest(), new MockHttpServletResponse(), mock(FilterChain.class)))
        .hasMessageContaining("linked to another Jenius account");
  }

  private JwtAuthenticationToken authentication(String username, String subject) {
    Instant now = Instant.now();
    Jwt jwt = new Jwt(
        "token", now, now.plusSeconds(300), Map.of("alg", "none"),
        Map.of("sub", subject, "preferred_username", username));
    return new JwtAuthenticationToken(jwt, List.of(), username);
  }
}
