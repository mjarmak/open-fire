package com.jarmak.stockmarketanalyzer.config;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import org.springframework.security.crypto.password.PasswordEncoder;

public final class SaltedSha256PasswordEncoder implements PasswordEncoder {
  private final String fixedSalt;

  public SaltedSha256PasswordEncoder(String fixedSalt) {
    this.fixedSalt = fixedSalt;
  }

  @Override
  public String encode(CharSequence rawPassword) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hashed = digest.digest((fixedSalt + rawPassword).getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(hashed);
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is not available", exception);
    }
  }

  @Override
  public boolean matches(CharSequence rawPassword, String encodedPassword) {
    return MessageDigest.isEqual(
        encode(rawPassword).getBytes(StandardCharsets.UTF_8),
        encodedPassword.getBytes(StandardCharsets.UTF_8)
    );
  }
}
