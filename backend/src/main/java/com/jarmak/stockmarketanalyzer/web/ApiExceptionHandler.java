package com.jarmak.stockmarketanalyzer.web;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
  @ExceptionHandler(IllegalStateException.class)
  @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
  ErrorResponse handleIllegalState(IllegalStateException exception) {
    return new ErrorResponse(exception.getMessage());
  }

  public record ErrorResponse(String message) {
  }
}
