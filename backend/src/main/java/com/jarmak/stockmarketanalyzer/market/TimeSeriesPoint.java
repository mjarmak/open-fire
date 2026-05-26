package com.jarmak.stockmarketanalyzer.market;

import java.time.LocalDate;

public record TimeSeriesPoint(LocalDate date, double value) {
}
