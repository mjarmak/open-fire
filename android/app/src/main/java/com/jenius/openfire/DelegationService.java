package com.jenius.openfire;



public class DelegationService extends
        com.google.androidbrowserhelper.trusted.DelegationService {
    @Override
    public android.os.Bundle onGetSmallIconBitmap() {
        // BitmapFactory does not decode vector resources for browsers requesting a bitmap icon.
        android.graphics.drawable.Drawable icon = getDrawable(R.drawable.ic_stat_openfire);
        android.graphics.Bitmap bitmap = android.graphics.Bitmap.createBitmap(72, 72, android.graphics.Bitmap.Config.ARGB_8888);
        icon.setBounds(0, 0, 72, 72);
        icon.draw(new android.graphics.Canvas(bitmap));
        android.os.Bundle result = new android.os.Bundle();
        result.putParcelable(androidx.browser.trusted.TrustedWebActivityService.KEY_SMALL_ICON_BITMAP, bitmap);
        return result;
    }
    @Override
    public void onCreate() {
        super.onCreate();

        
    }
}
