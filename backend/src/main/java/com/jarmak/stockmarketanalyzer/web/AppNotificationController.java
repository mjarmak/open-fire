package com.jarmak.stockmarketanalyzer.web;

import com.jarmak.stockmarketanalyzer.notification.AppNotificationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.security.Principal;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/notifications/app")
public class AppNotificationController {
  private final AppNotificationService service;
  public AppNotificationController(AppNotificationService service) { this.service = service; }
  @ExceptionHandler(org.springframework.web.bind.MethodArgumentNotValidException.class)
  @ResponseStatus(HttpStatus.BAD_REQUEST)
  Map<String, String> invalidSubscription() { return Map.of("message", "Invalid notification settings or subscription."); }
  public record Endpoint(@NotBlank @Size(max = 2048) String endpoint) {}
  public record Keys(@NotBlank @Size(max = 100) String p256dh, @NotBlank @Size(max = 32) String auth) {}
  public record Subscription(@NotBlank @Size(max = 2048) String endpoint, @NotNull @Valid Keys keys) {}

  @GetMapping("/settings")
  AppNotificationService.Configuration settings(Principal principal) throws SQLException { return service.configuration(principal.getName()); }
  @PutMapping("/settings") @ResponseStatus(HttpStatus.NO_CONTENT)
  void settings(Principal principal, @Valid @RequestBody AppNotificationService.Preferences preferences) throws SQLException {
    service.preferences(principal.getName(), preferences);
  }
  @GetMapping
  List<AppNotificationService.Message> inbox(Principal principal, @RequestParam(defaultValue = "9223372036854775807") long before) throws SQLException {
    return service.inbox(principal.getName(), before);
  }
  @PostMapping("/subscriptions") @ResponseStatus(HttpStatus.NO_CONTENT)
  void subscribe(Principal principal, @Valid @RequestBody Subscription subscription) throws SQLException {
    try { service.subscribe(principal.getName(), subscription.endpoint(), subscription.keys().p256dh(), subscription.keys().auth()); }
    catch (IllegalArgumentException invalid) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, invalid.getMessage()); }
  }
  @DeleteMapping("/subscriptions") @ResponseStatus(HttpStatus.NO_CONTENT)
  void unsubscribe(Principal principal, @Valid @RequestBody Endpoint endpoint) throws SQLException { service.unsubscribe(principal.getName(), endpoint.endpoint()); }
  @PostMapping("/test") @ResponseStatus(HttpStatus.ACCEPTED)
  void test(Principal principal, @Valid @RequestBody Endpoint endpoint) throws SQLException { service.test(principal.getName(), endpoint.endpoint()); }
}
