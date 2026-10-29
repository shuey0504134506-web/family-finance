package com.familyfinance.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // עדכון האפליקציה מתוך האפליקציה (הורדה והתקנה בלי דפדפן)
        registerPlugin(AppUpdaterPlugin.class);
        // שמירת גיבויים וייצוא ישר לתיקיית ההורדות
        registerPlugin(FileSaverPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
