package com.familyfinance.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

/**
 * ווידג'ט למסך הבית: שני כפתורי הוספה (הכנסה בירוק, הוצאה באדום) שפותחים ישר את טופס ההוספה באפליקציה.
 * הכפתורים שולחים כתובת com.familyfinance.app://quick/income או /expense, והאפליקציה מנווטת אליה.
 */
public class QuickAddWidget extends AppWidgetProvider {
    static PendingIntent quickIntent(Context context, String type, int requestCode) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("com.familyfinance.app://quick/" + type));
        intent.setComponent(new ComponentName(context, MainActivity.class));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_add);
            views.setOnClickPendingIntent(R.id.widget_add_income, quickIntent(context, "income", 1));
            views.setOnClickPendingIntent(R.id.widget_add_expense, quickIntent(context, "expense", 2));
            manager.updateAppWidget(id, views);
        }
    }
}
