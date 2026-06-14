package com.jarmak.stockmarketanalyzer.web;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {
  private final MarketApiRequestInterceptor marketApiRequestInterceptor;

  public WebMvcConfig(MarketApiRequestInterceptor marketApiRequestInterceptor) {
    this.marketApiRequestInterceptor = marketApiRequestInterceptor;
  }

  @Override
  public void addInterceptors(InterceptorRegistry registry) {
    registry.addInterceptor(marketApiRequestInterceptor).addPathPatterns("/api/**");
  }
}
