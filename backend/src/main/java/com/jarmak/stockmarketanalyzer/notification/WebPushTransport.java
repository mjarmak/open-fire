package com.jarmak.stockmarketanalyzer.notification;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.Security;
import java.time.Duration;
import java.util.Base64;
import java.util.Locale;
import nl.martijndwars.webpush.Encoding;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.AbstractPushService;
import nl.martijndwars.webpush.Utils;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class WebPushTransport {
  private final Encoder push;
  private final String publicKey;
  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10))
      .followRedirects(HttpClient.Redirect.NEVER).build();

  public WebPushTransport(@Value("${OPENFIRE_PUSH_PUBLIC_KEY:}") String publicKey,
      @Value("${OPENFIRE_PUSH_PRIVATE_KEY:}") String privateKey,
      @Value("${OPENFIRE_PUSH_SUBJECT:mailto:support@jeniusapps.com}") String subject) throws Exception {
    Security.addProvider(new BouncyCastleProvider());
    this.publicKey = publicKey;
    push = publicKey.isBlank() || privateKey.isBlank() ? null : new Encoder(publicKey, privateKey, subject);
    if (push == null) {
      org.slf4j.LoggerFactory.getLogger(WebPushTransport.class).warn(
          "App push delivery is disabled; configure OPENFIRE_PUSH_PUBLIC_KEY and OPENFIRE_PUSH_PRIVATE_KEY.");
    }
  }

  public boolean enabled() { return push != null; }
  public String publicKey() { return enabled() ? publicKey : ""; }

  static void validateEndpoint(String endpoint) {
    try {
      URI uri = URI.create(endpoint);
      String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
      boolean knownProvider = host.equals("fcm.googleapis.com") || host.equals("web.push.apple.com")
          || host.equals("updates.push.services.mozilla.com") || host.endsWith(".push.services.mozilla.com")
          || host.endsWith(".notify.windows.com") || host.endsWith(".wns.windows.com");
      if (!knownProvider || !"https".equals(uri.getScheme()) || uri.getUserInfo() != null
          || uri.getFragment() != null || (uri.getPort() != -1 && uri.getPort() != 443)
          || uri.getPath() == null || uri.getPath().length() < 2 || endpoint.length() > 2048) {
        throw new IllegalArgumentException();
      }
    } catch (RuntimeException invalid) { throw new IllegalArgumentException("Unsupported push endpoint."); }
  }

  static void validateKeys(String publicKey, String auth) {
    try {
      byte[] key = Base64.getUrlDecoder().decode(publicKey);
      if (key.length != 65 || key[0] != 4 || Base64.getUrlDecoder().decode(auth).length != 16) {
        throw new IllegalArgumentException();
      }
      Utils.loadPublicKey(publicKey);
    } catch (Exception invalid) { throw new IllegalArgumentException("Invalid push subscription keys."); }
  }

  public int send(String endpoint, String key, String auth, String payload) throws Exception {
    var encrypted = prepare(endpoint, key, auth, payload);
    var request = HttpRequest.newBuilder(URI.create(endpoint)).timeout(Duration.ofSeconds(15));
    encrypted.getHeaders().forEach(request::header);
    request.POST(HttpRequest.BodyPublishers.ofByteArray(encrypted.getBody()));
    return http.send(request.build(), HttpResponse.BodyHandlers.discarding()).statusCode();
  }

  nl.martijndwars.webpush.HttpRequest prepare(String endpoint, String key, String auth, String payload) throws Exception {
    if (!enabled()) { throw new IllegalStateException("Push delivery is not configured."); }
    validateEndpoint(endpoint);
    if (payload.getBytes(StandardCharsets.UTF_8).length > 3500) { throw new IllegalArgumentException("Push payload too large."); }
    // The proven Web Push library owns encryption/VAPID; JDK HTTP bounds timeouts and disallows redirects.
    return push.encode(new Notification(endpoint, key, auth, payload.getBytes(StandardCharsets.UTF_8), 3600));
  }

  private static final class Encoder extends AbstractPushService<Encoder> {
    Encoder(String publicKey, String privateKey, String subject) throws Exception { super(publicKey, privateKey, subject); }
    nl.martijndwars.webpush.HttpRequest encode(Notification notification) throws Exception {
      return prepareRequest(notification, Encoding.AES128GCM);
    }
  }
}
