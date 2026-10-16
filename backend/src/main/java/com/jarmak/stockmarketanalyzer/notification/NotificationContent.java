package com.jarmak.stockmarketanalyzer.notification;

import org.springframework.web.util.HtmlUtils;

public final class NotificationContent {
  public static final String RETURN_REMINDER = "It has been a week since your last visit. Review your positions, update your profile and retirement settings, and check your DCA plan.";
  private NotificationContent() {}
  public static String plainText(String content) {
    return HtmlUtils.htmlUnescape(content.replace("<b>", "").replace("</b>", ""));
  }
}
