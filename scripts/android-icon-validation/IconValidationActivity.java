package com.jenius.openfire.iconvalidation;

import android.app.Activity;
import android.content.pm.PackageInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Region;
import android.graphics.drawable.AdaptiveIconDrawable;
import android.graphics.drawable.Drawable;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import java.io.File;
import java.io.FileOutputStream;

public final class IconValidationActivity extends Activity {
    private static final String TARGET = "com.jenius.openfire";
    private final String[] shapes = {"Circle", "Rounded square", "Squircle", "Teardrop"};

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        String runId = getIntent().getStringExtra("runId");
        try {
            PackageInfo info = getPackageManager().getPackageInfo(TARGET, 0);
            Drawable icon = getPackageManager().getApplicationIcon(TARGET);
            if (!(icon instanceof AdaptiveIconDrawable)) throw new AssertionError("Missing adaptive icon");
            Bitmap sheet = Bitmap.createBitmap(1280, 1160, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(sheet);
            canvas.drawColor(Color.rgb(243, 245, 247));
            Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
            text.setColor(Color.rgb(25, 30, 38));
            text.setTextSize(30);
            canvas.drawText("OpenFIRE " + info.versionName + " - compiled release icon", 32, 55, text);
            text.setTextSize(23);
            canvas.drawText("4 masks x 3 sizes: no logo pixels clipped", 32, 98, text);
            int[] sizes = {48, 72, 96};
            for (int row = 0; row < sizes.length; row++) {
                int size = sizes[row] * 3;
                for (int column = 0; column < shapes.length; column++) {
                    icon.setBounds(0, 0, size, size);
                    AdaptiveIconDrawable adaptive = (AdaptiveIconDrawable) icon;
                    Bitmap raw = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
                    Canvas rawCanvas = new Canvas(raw);
                    adaptive.getBackground().draw(rawCanvas);
                    adaptive.getForeground().draw(rawCanvas);
                    Path mask = mask(column, size);
                    Region region = new Region();
                    region.setPath(mask, new Region(0, 0, size, size));
                    int artwork = 0;
                    for (int y = 0; y < size; y++) {
                        for (int x = 0; x < size; x++) {
                            int pixel = raw.getPixel(x, y);
                            int delta = Math.max(Math.abs(Color.red(pixel) - 16),
                                    Math.max(Math.abs(Color.green(pixel) - 16), Math.abs(Color.blue(pixel) - 16)));
                            if (Color.alpha(pixel) < 200 || delta < 40) continue;
                            artwork++;
                            double radius = Math.hypot(x + 0.5 - size / 2.0, y + 0.5 - size / 2.0);
                            if (!region.contains(x, y) || radius > size * 33.0 / 72.0) {
                                throw new AssertionError(shapes[column] + " clips artwork at size " + sizes[row]);
                            }
                            if (radius > size * 26.0 / 72.0) {
                                throw new AssertionError("Logo needs more padding at size " + sizes[row]);
                            }
                        }
                    }
                    if (artwork < size * size / 10) throw new AssertionError("Logo rendered too small or blank");
                    int cellX = column * 320;
                    int cellY = 125 + row * 320;
                    canvas.drawText(shapes[column] + " / " + sizes[row] + "dp", cellX + 15, cellY + 30, text);
                    canvas.save();
                    canvas.translate(cellX + (320 - size) / 2f, cellY + 55);
                    canvas.clipPath(mask);
                    canvas.drawBitmap(raw, 0, 0, null);
                    canvas.restore();
                    Log.i("OpenFireIconQA", "PASS " + shapes[column] + " " + sizes[row] + "dp; artwork=" + artwork);
                    raw.recycle();
                }
            }
            text.setColor(Color.rgb(20, 115, 70));
            canvas.drawText("PASS - all 12 compiled-icon checks", 32, 1140, text);
            File output = new File(getExternalFilesDir(null), "icon-masks.png");
            try (FileOutputStream stream = new FileOutputStream(output)) {
                sheet.compress(Bitmap.CompressFormat.PNG, 100, stream);
            }
            Log.i("OpenFireIconQA", "RESULT PASS run=" + runId + " version=" + info.versionName + " code=" + info.getLongVersionCode());
            setContentView(new View(this) {
                @Override protected void onDraw(Canvas viewCanvas) {
                    super.onDraw(viewCanvas);
                    float scale = Math.min(getWidth() / 1280f, getHeight() / 1160f);
                    viewCanvas.scale(scale, scale);
                    viewCanvas.drawBitmap(sheet, 0, 0, null);
                }
            });
        } catch (Throwable failure) {
            Log.e("OpenFireIconQA", "RESULT FAIL run=" + runId, failure);
            android.widget.TextView message = new android.widget.TextView(this);
            message.setText("Icon validation failed: " + failure);
            setContentView(message);
        }
    }

    private Path mask(int shape, int size) {
        Path path = new Path();
        if (shape == 0) {
            path.addCircle(size / 2f, size / 2f, size / 2f, Path.Direction.CW);
        } else if (shape == 1) {
            path.addRoundRect(new RectF(0, 0, size, size), size * 0.22f, size * 0.22f, Path.Direction.CW);
        } else if (shape == 2) {
            for (int degree = 0; degree < 360; degree++) {
                double angle = Math.toRadians(degree);
                double cos = Math.cos(angle), sin = Math.sin(angle);
                float x = (float) (size / 2.0 * (1 + Math.copySign(Math.sqrt(Math.abs(cos)), cos)));
                float y = (float) (size / 2.0 * (1 + Math.copySign(Math.sqrt(Math.abs(sin)), sin)));
                if (degree == 0) path.moveTo(x, y); else path.lineTo(x, y);
            }
            path.close();
        } else {
            path.addRoundRect(new RectF(0, 0, size, size), new float[] {
                    size / 2f, size / 2f, size / 2f, size / 2f, 0, 0, size / 2f, size / 2f}, Path.Direction.CW);
        }
        return path;
    }
}
