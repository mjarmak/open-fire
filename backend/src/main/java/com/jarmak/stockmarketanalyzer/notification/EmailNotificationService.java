package com.jarmak.stockmarketanalyzer.notification;

import java.util.Map;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.HtmlUtils;

@Service
public class EmailNotificationService {
  private final RestClient client;
  private final String apiKey;
  private final String appUrl;

  @org.springframework.beans.factory.annotation.Autowired
  public EmailNotificationService(@Value("${OPENFIRE_NOVU_API_URL:}") String apiUrl,
      @Value("${OPENFIRE_NOVU_API_KEY:}") String apiKey,
      @Value("${OPENFIRE_PUBLIC_APP_URL:https://openfire.jeniusapps.com}") String appUrl) {
    var factory = new org.springframework.http.client.JdkClientHttpRequestFactory(
        java.net.http.HttpClient.newBuilder().connectTimeout(java.time.Duration.ofSeconds(10)).build());
    factory.setReadTimeout(java.time.Duration.ofSeconds(10));
    this.client = RestClient.builder().baseUrl(apiUrl).requestFactory(factory).build();
    this.apiKey = apiUrl.isBlank() ? "" : apiKey;
    this.appUrl = appUrl.replaceAll("/$", "");
  }

  EmailNotificationService(RestClient client, String apiKey, String appUrl) {
    this.client = client;
    this.apiKey = apiKey;
    this.appUrl = appUrl;
  }

  public boolean enabled() { return !apiKey.isBlank(); }

  public void send(String key, String username, String address, String kind, String content) {
    String subject = kind.equals("dca") ? "Your OpenFIRE DCA reminder" : "Time to check your OpenFIRE plan";
    JsonNode response = client.post().uri("/v1/events/trigger")
        .header("Authorization", "ApiKey " + apiKey).header("Idempotency-Key", key)
        .body(Map.of("name", "open-fire-" + kind, "transactionId", key,
            "to", Map.of("subscriberId", "open-fire:" + username, "email", address),
            "payload", Map.of("subject", subject, "html", html(subject, content),
                "text", HtmlUtils.htmlUnescape(content.replace("<b>", "").replace("</b>", "")) + "\n\n" + appUrl,
                "actionUrl", appUrl)))
        .retrieve().body(JsonNode.class);
    if (response == null || response.path("acknowledged").asText().equals("false")
        || response.path("data").path("acknowledged").asText().equals("false")) {
      throw new IllegalStateException("Email event was not acknowledged");
    }
  }

  String html(String subject, String content) {
    // Generated Telegram content escapes personal notes; permit only server-generated bold tags.
    String body = escape(content).replace("&lt;b&gt;", "<b>").replace("&lt;/b&gt;", "</b>")
        .replace("&amp;lt;", "&lt;").replace("&amp;gt;", "&gt;").replace("&amp;amp;", "&amp;")
        .replace("\n", "<br>");
    String url = escape(appUrl);
    return """
        <html><body style="margin:0;background:#f3f5f7;font-family:Arial,sans-serif;color:#20242b">
        <table role="presentation" width="100%%"><tr><td style="padding:24px">
        <table role="presentation" width="100%%" style="max-width:600px;margin:auto;background:white;border-radius:8px">
        <tr><td style="padding:28px"><img src="%s/openfire-logo-dark-v2-192.png" alt="OpenFIRE" width="64" height="64">
        <h1 style="font-size:24px">%s</h1><p style="line-height:1.7">%s</p>
        <p><a href="%s" style="display:inline-block;padding:14px 20px;background:#2563eb;color:white;border-radius:6px;text-decoration:none">Open my dashboard</a></p>
        <p style="font-size:12px;color:#667085">Manage email preferences in DCA Configure in OpenFIRE. Projections are estimates, not investment advice.</p>
        </td></tr></table></td></tr></table></body></html>
        """.formatted(url, escape(subject), body, url);
  }

  private String escape(String value) { return HtmlUtils.htmlEscape(value); }
}
