package com.jarmak.stockmarketanalyzer.web;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.jarmak.stockmarketanalyzer.notification.AppNotificationService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class AppNotificationControllerTest {
  final AppNotificationService service = mock(AppNotificationService.class);
  final org.springframework.test.web.servlet.MockMvc mvc = MockMvcBuilders.standaloneSetup(new AppNotificationController(service)).build();
  @Test void routesSubscriptionsToPrincipalNotCallerProvidedIdentity() throws Exception {
    mvc.perform(post("/api/notifications/app/subscriptions").principal(() -> "alice").contentType(MediaType.APPLICATION_JSON)
        .content("{\"username\":\"bob\",\"endpoint\":\"https://fcm.googleapis.com/device\",\"keys\":{\"p256dh\":\"key\",\"auth\":\"auth\"}}"))
        .andExpect(status().isNoContent());
    verify(service).subscribe("alice", "https://fcm.googleapis.com/device", "key", "auth");
  }
  @Test void rejectsMissingKeysWithoutEchoingCredentials() throws Exception {
    mvc.perform(post("/api/notifications/app/subscriptions").principal(() -> "alice").contentType(MediaType.APPLICATION_JSON)
        .content("{\"endpoint\":\"https://fcm.googleapis.com/private-token\"}"))
        .andExpect(status().isBadRequest()).andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private-token"))));
    verifyNoInteractions(service);
  }
  @Test void testNotificationCannotChooseAnotherRecipientOrMessage() throws Exception {
    mvc.perform(post("/api/notifications/app/test").principal(() -> "alice").contentType(MediaType.APPLICATION_JSON)
        .content("{\"endpoint\":\"https://fcm.googleapis.com/device\",\"username\":\"bob\",\"message\":\"arbitrary\"}"))
        .andExpect(status().isAccepted());
    verify(service).test("alice", "https://fcm.googleapis.com/device");
  }
  @Test void scopesInboxAndRemovalToPrincipal() throws Exception {
    mvc.perform(get("/api/notifications/app?before=100").principal(() -> "alice")).andExpect(status().isOk());
    verify(service).inbox("alice", 100);
    mvc.perform(delete("/api/notifications/app/subscriptions").principal(() -> "alice").contentType(MediaType.APPLICATION_JSON)
        .content("{\"endpoint\":\"device\"}")).andExpect(status().isNoContent());
    verify(service).unsubscribe("alice", "device");
  }
}
