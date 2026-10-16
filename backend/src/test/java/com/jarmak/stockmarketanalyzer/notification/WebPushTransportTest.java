package com.jarmak.stockmarketanalyzer.notification;

import static org.assertj.core.api.Assertions.*;
import java.security.KeyPairGenerator;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class WebPushTransportTest {
  @ParameterizedTest
  @ValueSource(strings = {"https://fcm.googleapis.com/fcm/send/device", "https://updates.push.services.mozilla.com/wpush/v2/device",
      "https://web.push.apple.com/device", "https://abc.notify.windows.com/device"})
  void acceptsKnownHttpsPushProviders(String endpoint) { assertThatCode(() -> WebPushTransport.validateEndpoint(endpoint)).doesNotThrowAnyException(); }

  @ParameterizedTest
  @ValueSource(strings = {"http://fcm.googleapis.com/send", "https://127.0.0.1/admin", "https://169.254.169.254/latest/meta-data",
      "https://fcm.googleapis.com.attacker.com/send", "https://fcm.googleapis.com@evil.test/send",
      "https://fcm.googleapis.com:8443/send", "https://fcm.googleapis.com/send#fragment", "file:///etc/passwd"})
  void rejectsSsrfAndUntrustedDestinations(String endpoint) { assertThatIllegalArgumentException().isThrownBy(() -> WebPushTransport.validateEndpoint(endpoint)); }

  @Test void validatesRealP256KeysAndRejectsMalformedKeys() throws Exception {
    new WebPushTransport("", "", "mailto:test@example.com");
    var generator = KeyPairGenerator.getInstance("ECDH", "BC"); generator.initialize(new ECGenParameterSpec("secp256r1"));
    var publicKey = (org.bouncycastle.jce.interfaces.ECPublicKey) generator.generateKeyPair().getPublic();
    String key = Base64.getUrlEncoder().withoutPadding().encodeToString(publicKey.getQ().getEncoded(false));
    String auth = Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[16]);
    assertThatCode(() -> WebPushTransport.validateKeys(key, auth)).doesNotThrowAnyException();
    assertThatIllegalArgumentException().isThrownBy(() -> WebPushTransport.validateKeys(key, "bad"));
    assertThatIllegalArgumentException().isThrownBy(() -> WebPushTransport.validateKeys("not-a-key", auth));
  }

  @Test void unconfiguredTransportDoesNotMakeRequests() throws Exception {
    var transport = new WebPushTransport("", "", "mailto:test@example.com");
    assertThat(transport.enabled()).isFalse(); assertThat(transport.publicKey()).isEmpty();
    assertThatIllegalStateException().isThrownBy(() -> transport.send("https://fcm.googleapis.com/device", "", "", "{}"));
  }

  @Test void encryptsPayloadAndAddsVapidAuthenticationWithoutMakingNetworkCalls() throws Exception {
    new WebPushTransport("", "", "mailto:test@example.com");
    var generator = KeyPairGenerator.getInstance("ECDH", "BC"); generator.initialize(new ECGenParameterSpec("secp256r1"));
    var server = generator.generateKeyPair(); var browser = generator.generateKeyPair();
    var encoder = Base64.getUrlEncoder().withoutPadding();
    String publicKey = encoder.encodeToString(((org.bouncycastle.jce.interfaces.ECPublicKey) server.getPublic()).getQ().getEncoded(false));
    String privateKey = encoder.encodeToString(((org.bouncycastle.jce.interfaces.ECPrivateKey) server.getPrivate()).getD().toByteArray());
    String browserKey = encoder.encodeToString(((org.bouncycastle.jce.interfaces.ECPublicKey) browser.getPublic()).getQ().getEncoded(false));
    var transport = new WebPushTransport(publicKey, privateKey, "mailto:test@example.com");
    var request = transport.prepare("https://fcm.googleapis.com/fcm/send/test", browserKey, encoder.encodeToString(new byte[16]), "Private portfolio reminder");
    assertThat(request.getHeaders().get("Content-Encoding")).isEqualTo("aes128gcm");
    assertThat(request.getHeaders().get("Authorization")).startsWith("vapid ");
    assertThat(new String(request.getBody(), java.nio.charset.StandardCharsets.UTF_8)).doesNotContain("Private portfolio reminder");
    assertThat(request.getHeaders().get("TTL")).isEqualTo("3600");
    var http = java.net.http.HttpRequest.newBuilder(java.net.URI.create(request.getUrl()));
    request.getHeaders().forEach(http::header);
    assertThatCode(() -> http.POST(java.net.http.HttpRequest.BodyPublishers.ofByteArray(request.getBody())).build())
        .doesNotThrowAnyException();
    assertThat(transport.enabled()).isTrue();
  }
}
