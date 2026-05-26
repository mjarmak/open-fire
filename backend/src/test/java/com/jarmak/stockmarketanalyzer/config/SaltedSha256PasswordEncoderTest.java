package com.jarmak.stockmarketanalyzer.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SaltedSha256PasswordEncoderTest {
  @Test
  void matchesConfiguredDefaultPassword() {
    SaltedSha256PasswordEncoder encoder = new SaltedSha256PasswordEncoder("stock-market-analyzer-fixed-salt");

    assertThat(encoder.matches(
        "admin123",
        "289c2e841c28c4832e2430b195c867455f9bbc9bb3408706074b357e8d8e8c1f"
    )).isTrue();
  }
}
