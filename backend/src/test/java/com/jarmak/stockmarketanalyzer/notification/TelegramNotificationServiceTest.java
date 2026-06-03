package com.jarmak.stockmarketanalyzer.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.jarmak.stockmarketanalyzer.config.AppProperties;
import com.jarmak.stockmarketanalyzer.security.UserAccountService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class TelegramNotificationServiceTest {
  @Test
  void sendsTextMessageThroughTelegramBotApi() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    UserAccountService userAccountService = mock(UserAccountService.class);
    when(userAccountService.currentTelegramChatId()).thenReturn(Optional.of("98765"));
    TelegramNotificationService service = new TelegramNotificationService(properties(true, "123456:test-token"), userAccountService, builder.build());

    server.expect(requestTo("https://api.telegram.org/bot123456:test-token/sendMessage"))
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_FORM_URLENCODED))
        .andExpect(content().string(containsString("chat_id=98765")))
        .andExpect(content().string(containsString("text=hello")))
        .andRespond(withSuccess("""
            {"ok":true}
            """, MediaType.APPLICATION_JSON));

    TelegramNotificationService.NotificationResult result = service.send("hello");

    assertThat(result.sent()).isTrue();
    assertThat(result.message()).isEqualTo("Telegram message sent.");
    server.verify();
  }

  @Test
  void requiresBotToken() {
    UserAccountService userAccountService = mock(UserAccountService.class);
    TelegramNotificationService service = new TelegramNotificationService(properties(true, ""), userAccountService, RestClient.create());

    TelegramNotificationService.NotificationResult result = service.send("hello");

    assertThat(result.sent()).isFalse();
    assertThat(result.message()).isEqualTo("Telegram is disabled or missing bot token.");
    assertThat(result.missingChatId()).isFalse();
  }

  @Test
  void asksForChatIdWhenCurrentUserHasNone() {
    UserAccountService userAccountService = mock(UserAccountService.class);
    when(userAccountService.currentTelegramChatId()).thenReturn(Optional.empty());
    TelegramNotificationService service = new TelegramNotificationService(properties(true, "123456:test-token"), userAccountService, RestClient.create());

    TelegramNotificationService.NotificationResult result = service.send("hello");

    assertThat(result.sent()).isFalse();
    assertThat(result.missingChatId()).isTrue();
    assertThat(result.message()).isEqualTo("Add your Telegram chat ID before sending messages.");
  }

  private AppProperties properties(boolean enabled, String botToken) {
    return new AppProperties(
        null,
        new AppProperties.Market(
            "fred",
            "finnhub",
            List.of(),
            List.of(),
            BigDecimal.valueOf(2_000_000_000L),
            BigDecimal.valueOf(35),
            BigDecimal.valueOf(25),
            BigDecimal.valueOf(25),
            BigDecimal.valueOf(1.5),
            BigDecimal.valueOf(40),
            BigDecimal.valueOf(20),
            BigDecimal.valueOf(65)
        ),
        null,
        new AppProperties.Telegram(enabled, "sma3141_bot", botToken),
        null
    );
  }
}
