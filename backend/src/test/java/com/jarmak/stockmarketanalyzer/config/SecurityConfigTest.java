package com.jarmak.stockmarketanalyzer.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.mock.web.MockHttpServletRequest;

class SecurityConfigTest {
  @Test
  void corsAllowsConfiguredCloudOriginForWritePreflight() {
    SecurityConfig securityConfig = new SecurityConfig();
    CorsConfigurationSource source = securityConfig.corsConfigurationSource(properties("https://app.example.com"));
    MockHttpServletRequest request = new MockHttpServletRequest("OPTIONS", "/api/users/me/dca");

    CorsConfiguration configuration = source.getCorsConfiguration(request);

    assertThat(configuration).isNotNull();
    assertThat(configuration.checkOrigin("https://app.example.com")).isEqualTo("https://app.example.com");
    assertThat(configuration.checkHttpMethod(org.springframework.http.HttpMethod.PUT)).isNotEmpty();
    assertThat(configuration.getAllowedHeaders()).contains("*");
    assertThat(configuration.getAllowCredentials()).isTrue();
  }

  @Test
  void corsWildcardPatternReflectsRequestOrigin() {
    SecurityConfig securityConfig = new SecurityConfig();
    CorsConfigurationSource source = securityConfig.corsConfigurationSource(properties("*"));
    MockHttpServletRequest request = new MockHttpServletRequest("OPTIONS", "/api/portfolio");

    CorsConfiguration configuration = source.getCorsConfiguration(request);

    assertThat(configuration).isNotNull();
    assertThat(configuration.checkOrigin("https://frontend.example.com")).isEqualTo("https://frontend.example.com");
    assertThat(configuration.checkHttpMethod(org.springframework.http.HttpMethod.POST)).isNotEmpty();
  }

  private AppProperties properties(String allowedOriginPattern) {
    return new AppProperties(
        new AppProperties.Security("admin", "salt", "hash"),
        new AppProperties.Market(null, null, null, null, null, null, List.of(), List.of(), null, null, null, null, null, null, null, null),
        new AppProperties.Database("jdbc:postgresql://localhost/open_fire", "admin", "password"),
        new AppProperties.Telegram(false, "bot", "token"),
        new AppProperties.Cors(List.of(allowedOriginPattern))
    );
  }
}
