package com.jarmak.stockmarketanalyzer.notification;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.http.MediaType;
import org.junit.jupiter.api.Test;

class EmailNotificationServiceTest {
  @Test void sendsAppOwnedWorkflowWithStableIdempotencyKey() {
    var builder = RestClient.builder().baseUrl("https://novu.example");
    var server = MockRestServiceServer.bindTo(builder).build();
    var service = new EmailNotificationService(builder.build(), "test-key", "https://app.example");
    server.expect(requestTo("https://novu.example/v1/events/trigger"))
        .andExpect(header("Authorization", "ApiKey test-key"))
        .andExpect(header("Idempotency-Key", "dca-event"))
        .andExpect(jsonPath("$.name").value("open-fire-dca"))
        .andExpect(jsonPath("$.transactionId").value("dca-event"))
        .andExpect(jsonPath("$.to.email").value("alice@example.com"))
        .andExpect(jsonPath("$.payload.subject").value("Your OpenFIRE DCA reminder"))
        .andRespond(withSuccess("{\"data\":{\"acknowledged\":true}}", MediaType.APPLICATION_JSON));
    service.send("dca-event", "alice", "alice@example.com", "dca", "<b>Planned DCA:</b> $100/month");
    server.verify();
  }

  @Test void rejectsUnacknowledgedEventsForRetry() {
    var builder = RestClient.builder().baseUrl("https://novu.example");
    var server = MockRestServiceServer.bindTo(builder).build();
    var service = new EmailNotificationService(builder.build(), "test-key", "https://app.example");
    server.expect(requestTo("https://novu.example/v1/events/trigger"))
        .andRespond(withSuccess("{\"data\":{\"acknowledged\":false}}", MediaType.APPLICATION_JSON));
    assertThatThrownBy(() -> service.send("return-event", "alice", "alice@example.com", "return", "Check your plan"))
        .isInstanceOf(IllegalStateException.class);
    server.verify();
  }

  @Test void propagatesProviderFailureForRetry() {
    var builder = RestClient.builder().baseUrl("https://novu.example");
    var server = MockRestServiceServer.bindTo(builder).build();
    var service = new EmailNotificationService(builder.build(), "test-key", "https://app.example");
    server.expect(requestTo("https://novu.example/v1/events/trigger")).andRespond(withServerError());
    assertThatThrownBy(() -> service.send("return-event", "alice", "alice@example.com", "return", "Check your plan"))
        .isInstanceOf(org.springframework.web.client.HttpServerErrorException.class);
    server.verify();
  }

  @Test void disabledWithoutBothNovuSettings() {
    assertThat(new EmailNotificationService("", "key", "https://app.example").enabled()).isFalse();
    assertThat(new EmailNotificationService("https://novu.example", "", "https://app.example").enabled()).isFalse();
  }

  @Test void rendersLogoLinkAndSafePersonalNote() {
    var service = new EmailNotificationService("", "", "https://app.example");
    String html = service.html("DCA reminder", "<b>Your DCA focus:</b> &lt;script&gt;bad&lt;/script&gt;\n<b>Planned DCA:</b> $100/month");
    assertThat(html).contains("https://app.example/openfire-logo-dark-v2-192.png", "Open my dashboard",
        "<b>Planned DCA:</b>", "$100/month", "&lt;script&gt;").doesNotContain("<script>");
  }
}
