package com.jarmak.stockmarketanalyzer.portfolio;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class PortfolioServiceTest {
  @Test
  void validatesHoldingsBeforeDatabaseWrite() {
    PortfolioService service = new PortfolioService(null);

    assertThatThrownBy(() -> service.upsert(" ", "Apple Inc.", BigDecimal.valueOf(12.5), BigDecimal.valueOf(170.25)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessage("Symbol is required.");
  }
}
