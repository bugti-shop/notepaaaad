# Android Home Screen Widgets for Npd

This guide provides complete Java code for implementing native Android widgets: **Notes Widget** and **Section Tasks Widget**.

## Package Name: `nota.npd.com`

## Prerequisites

1. Enable widgets in the app via Settings → Home Screen Widgets
2. The app syncs data to SharedPreferences automatically
3. Widgets read from these SharedPreferences keys:
   - `npd_widget_sections` - Sections with tasks
   - `npd_widget_note_{id}` - Specific note data

## Project Structure

```
android/app/src/main/
├── java/nota/npd/com/
│   ├── MainActivity.java
│   └── widgets/
│       ├── WidgetDataHelper.java
│       ├── SpecificNoteWidget.java
│       └── SectionTasksWidget.java
├── res/
│   ├── layout/
│   │   ├── widget_specific_note.xml
│   │   ├── widget_section_tasks.xml
│   │   └── widget_task_item.xml
│   ├── xml/
│   │   ├── specific_note_widget_info.xml
│   │   └── section_tasks_widget_info.xml
│   └── drawable/
│       └── widget_background.xml
```

---

## 1. Widget Data Helper

**File:** `android/app/src/main/java/nota/npd/com/widgets/WidgetDataHelper.java`

```java
package nota.npd.com.widgets;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

public class WidgetDataHelper {
    
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String KEY_SECTIONS = "npd_widget_sections";
    
    public static class Task {
        public String id;
        public String text;
        public boolean completed;
        public String priority;
        public String dueDate;
        public String sectionId;
    }
    
    public static class Note {
        public String id;
        public String title;
        public String content;
        public String type;
        public String color;
    }
    
    public static class Section {
        public String id;
        public String name;
        public List<Task> tasks;
    }
    
    private static SharedPreferences getPrefs(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }
    
    /**
     * Get a specific note by ID
     */
    public static Note getSpecificNote(Context context, String noteId) {
        try {
            String key = "npd_widget_note_" + noteId;
            String json = getPrefs(context).getString(key, null);
            
            if (json != null) {
                JSONObject noteObj = new JSONObject(json);
                Note note = new Note();
                note.id = noteObj.optString("id");
                note.title = noteObj.optString("title");
                note.content = noteObj.optString("content");
                note.type = noteObj.optString("type");
                note.color = noteObj.optString("color", null);
                return note;
            }
        } catch (JSONException e) {
            e.printStackTrace();
        }
        return null;
    }
    
    /**
     * Get sections with their tasks
     */
    public static List<Section> getSections(Context context) {
        List<Section> sections = new ArrayList<>();
        try {
            String json = getPrefs(context).getString(KEY_SECTIONS, "[]");
            JSONArray sectionsArray = new JSONArray(json);
            
            for (int i = 0; i < sectionsArray.length(); i++) {
                JSONObject sectionObj = sectionsArray.getJSONObject(i);
                Section section = new Section();
                section.id = sectionObj.optString("sectionId");
                section.name = sectionObj.optString("sectionName");
                section.tasks = new ArrayList<>();
                
                JSONArray tasksArray = sectionObj.optJSONArray("tasks");
                if (tasksArray != null) {
                    for (int j = 0; j < tasksArray.length(); j++) {
                        JSONObject taskObj = tasksArray.getJSONObject(j);
                        Task task = new Task();
                        task.id = taskObj.optString("id");
                        task.text = taskObj.optString("text");
                        task.completed = taskObj.optBoolean("completed", false);
                        task.priority = taskObj.optString("priority", "none");
                        section.tasks.add(task);
                    }
                }
                sections.add(section);
            }
        } catch (JSONException e) {
            e.printStackTrace();
        }
        return sections;
    }
    
    /**
     * Get priority color
     */
    public static int getPriorityColor(String priority) {
        switch (priority) {
            case "high": return 0xFFEF4444;
            case "medium": return 0xFFF59E0B;
            case "low": return 0xFF3B82F6;
            default: return 0xFF6B7280;
        }
    }
    
    /**
     * Get note type icon
     */
    public static String getNoteTypeIcon(String type) {
        switch (type) {
            case "regular": return "⬜";
            case "sticky": return "📕";
            case "lined": return "📄";
            case "code": return "💻";
            case "sketch": return "🎨";
            case "voice": return "🎤";
            default: return "📝";
        }
    }
}
```

---

## 2. Notes Widget (Specific Note)

**File:** `android/app/src/main/java/nota/npd/com/widgets/SpecificNoteWidget.java`

```java
package nota.npd.com.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.widget.RemoteViews;

import nota.npd.com.MainActivity;
import nota.npd.com.R;

public class SpecificNoteWidget extends AppWidgetProvider {

    private static final String PREFS_NAME = "SpecificNoteWidgetPrefs";
    private static final String PREF_NOTE_ID = "note_id_";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String noteId = prefs.getString(PREF_NOTE_ID + appWidgetId, null);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_specific_note);

        if (noteId != null) {
            WidgetDataHelper.Note note = WidgetDataHelper.getSpecificNote(context, noteId);
            
            if (note != null) {
                String icon = WidgetDataHelper.getNoteTypeIcon(note.type);
                views.setTextViewText(R.id.note_title, icon + " " + note.title);
                views.setTextViewText(R.id.note_content, note.content);
                views.setViewVisibility(R.id.note_container, android.view.View.VISIBLE);
                views.setViewVisibility(R.id.empty_view, android.view.View.GONE);

                // Set background color if available
                if (note.color != null && !note.color.isEmpty()) {
                    try {
                        int color = Color.parseColor(note.color);
                        views.setInt(R.id.widget_container, "setBackgroundColor", color);
                    } catch (Exception e) {
                        // Use default
                    }
                }
            } else {
                views.setViewVisibility(R.id.note_container, android.view.View.GONE);
                views.setViewVisibility(R.id.empty_view, android.view.View.VISIBLE);
            }
        } else {
            views.setViewVisibility(R.id.note_container, android.view.View.GONE);
            views.setViewVisibility(R.id.empty_view, android.view.View.VISIBLE);
        }

        // Click to open note in app
        Intent intent = new Intent(context, MainActivity.class);
        intent.putExtra("action", "open_note");
        intent.putExtra("noteId", noteId);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(context, appWidgetId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        views.setOnClickPendingIntent(R.id.widget_container, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    public static void setNoteId(Context context, int appWidgetId, String noteId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(PREF_NOTE_ID + appWidgetId, noteId).apply();
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        
        if ("nota.npd.com.WIDGET_UPDATE".equals(intent.getAction())) {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(
                new android.content.ComponentName(context, SpecificNoteWidget.class));
            for (int appWidgetId : appWidgetIds) {
                updateAppWidget(context, appWidgetManager, appWidgetId);
            }
        }
    }

    @Override
    public void onDeleted(Context context, int[] appWidgetIds) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        for (int appWidgetId : appWidgetIds) {
            editor.remove(PREF_NOTE_ID + appWidgetId);
        }
        editor.apply();
    }
}
```

---

## 3. Section Tasks Widget

**File:** `android/app/src/main/java/nota/npd/com/widgets/SectionTasksWidget.java`

```java
package nota.npd.com.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import nota.npd.com.MainActivity;
import nota.npd.com.R;

import java.util.ArrayList;
import java.util.List;

public class SectionTasksWidget extends AppWidgetProvider {

    private static final String PREFS_NAME = "SectionTasksWidgetPrefs";
    private static final String PREF_SECTION_ID = "section_id_";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String sectionId = prefs.getString(PREF_SECTION_ID + appWidgetId, null);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_section_tasks);

        List<WidgetDataHelper.Section> sections = WidgetDataHelper.getSections(context);
        WidgetDataHelper.Section targetSection = null;

        for (WidgetDataHelper.Section section : sections) {
            if (section.id != null && section.id.equals(sectionId)) {
                targetSection = section;
                break;
            }
        }

        if (targetSection != null) {
            views.setTextViewText(R.id.section_name, "📋 " + targetSection.name);
            
            // Set up ListView with RemoteViewsService
            Intent serviceIntent = new Intent(context, SectionTasksWidgetService.class);
            serviceIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
            serviceIntent.putExtra("section_id", sectionId);
            serviceIntent.setData(Uri.parse(serviceIntent.toUri(Intent.URI_INTENT_SCHEME)));
            
            views.setRemoteAdapter(R.id.tasks_list, serviceIntent);
            views.setEmptyView(R.id.tasks_list, R.id.empty_view);
        } else {
            views.setTextViewText(R.id.section_name, "📋 Section");
            views.setTextViewText(R.id.empty_view, "Select a section in app settings");
        }

        // Click to open app
        Intent intent = new Intent(context, MainActivity.class);
        intent.putExtra("route", "/todo/today");
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(context, appWidgetId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        views.setOnClickPendingIntent(R.id.widget_header, pendingIntent);

        // Add task button
        Intent addIntent = new Intent(context, MainActivity.class);
        addIntent.putExtra("action", "add_task");
        addIntent.putExtra("sectionId", sectionId);
        PendingIntent addPendingIntent = PendingIntent.getActivity(context, appWidgetId + 1000, addIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.add_task_button, addPendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    public static void setSectionId(Context context, int appWidgetId, String sectionId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(PREF_SECTION_ID + appWidgetId, sectionId).apply();
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        
        if ("nota.npd.com.WIDGET_UPDATE".equals(intent.getAction())) {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(
                new android.content.ComponentName(context, SectionTasksWidget.class));
            appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetIds, R.id.tasks_list);
        }
    }

    @Override
    public void onDeleted(Context context, int[] appWidgetIds) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        for (int appWidgetId : appWidgetIds) {
            editor.remove(PREF_SECTION_ID + appWidgetId);
        }
        editor.apply();
    }
}

// RemoteViewsService for Section Tasks
class SectionTasksWidgetService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new SectionTasksRemoteViewsFactory(getApplicationContext(), intent);
    }
}

// RemoteViewsFactory for Section Tasks
class SectionTasksRemoteViewsFactory implements RemoteViewsService.RemoteViewsFactory {
    private Context context;
    private String sectionId;
    private List<WidgetDataHelper.Task> tasks = new ArrayList<>();

    SectionTasksRemoteViewsFactory(Context context, Intent intent) {
        this.context = context;
        this.sectionId = intent.getStringExtra("section_id");
    }

    @Override
    public void onCreate() {
        loadTasks();
    }

    @Override
    public void onDataSetChanged() {
        loadTasks();
    }

    private void loadTasks() {
        tasks.clear();
        List<WidgetDataHelper.Section> sections = WidgetDataHelper.getSections(context);
        for (WidgetDataHelper.Section section : sections) {
            if (section.id != null && section.id.equals(sectionId)) {
                tasks.addAll(section.tasks);
                break;
            }
        }
    }

    @Override
    public void onDestroy() {
        tasks.clear();
    }

    @Override
    public int getCount() {
        return tasks.size();
    }

    @Override
    public RemoteViews getViewAt(int position) {
        if (position >= tasks.size()) {
            return null;
        }

        WidgetDataHelper.Task task = tasks.get(position);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_task_item);
        
        String checkbox = task.completed ? "☑" : "☐";
        views.setTextViewText(R.id.task_checkbox, checkbox);
        views.setTextViewText(R.id.task_text, task.text);
        views.setInt(R.id.priority_indicator, "setBackgroundColor", 
            WidgetDataHelper.getPriorityColor(task.priority));

        // Set up click intent
        Intent fillInIntent = new Intent();
        fillInIntent.putExtra("taskId", task.id);
        fillInIntent.putExtra("action", "toggle_task");
        views.setOnClickFillInIntent(R.id.task_item_container, fillInIntent);

        return views;
    }

    @Override
    public RemoteViews getLoadingView() {
        return null;
    }

    @Override
    public int getViewTypeCount() {
        return 1;
    }

    @Override
    public long getItemId(int position) {
        return position;
    }

    @Override
    public boolean hasStableIds() {
        return true;
    }
}
```

---

## 4. Layout Files

### res/layout/widget_specific_note.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_container"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:background="@drawable/widget_background"
    android:padding="12dp">

    <LinearLayout
        android:id="@+id/note_container"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:orientation="vertical"
        android:visibility="visible">

        <TextView
            android:id="@+id/note_title"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:textSize="16sp"
            android:textStyle="bold"
            android:textColor="#1F2937"
            android:maxLines="2"
            android:ellipsize="end"
            android:paddingBottom="8dp" />

        <ScrollView
            android:layout_width="match_parent"
            android:layout_height="match_parent">
            
            <TextView
                android:id="@+id/note_content"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:textSize="13sp"
                android:textColor="#374151"
                android:lineSpacingMultiplier="1.3" />
        </ScrollView>
    </LinearLayout>

    <TextView
        android:id="@+id/empty_view"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:gravity="center"
        android:text="Select a note in app settings"
        android:textColor="#9CA3AF"
        android:visibility="gone" />
</LinearLayout>
```

### res/layout/widget_section_tasks.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:background="@drawable/widget_background"
    android:padding="12dp">

    <LinearLayout
        android:id="@+id/widget_header"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:gravity="center_vertical"
        android:paddingBottom="8dp">

        <TextView
            android:id="@+id/section_name"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:text="📋 Section"
            android:textSize="16sp"
            android:textStyle="bold"
            android:textColor="#1F2937" />

        <ImageButton
            android:id="@+id/add_task_button"
            android:layout_width="32dp"
            android:layout_height="32dp"
            android:src="@android:drawable/ic_input_add"
            android:background="?android:attr/selectableItemBackgroundBorderless"
            android:contentDescription="Add task" />
    </LinearLayout>

    <ListView
        android:id="@+id/tasks_list"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:divider="@null"
        android:dividerHeight="4dp" />

    <TextView
        android:id="@+id/empty_view"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:gravity="center"
        android:text="No tasks in this section"
        android:textColor="#9CA3AF"
        android:visibility="gone" />
</LinearLayout>
```

### res/layout/widget_task_item.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/task_item_container"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="horizontal"
    android:gravity="center_vertical"
    android:padding="8dp"
    android:background="#FFFFFF">

    <View
        android:id="@+id/priority_indicator"
        android:layout_width="4dp"
        android:layout_height="match_parent"
        android:layout_marginEnd="8dp"
        android:background="#3B82F6" />

    <TextView
        android:id="@+id/task_checkbox"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:textSize="16sp"
        android:paddingEnd="8dp" />

    <TextView
        android:id="@+id/task_text"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:textSize="14sp"
        android:textColor="#374151"
        android:maxLines="2"
        android:ellipsize="end" />
</LinearLayout>
```

### res/drawable/widget_background.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="#FFFFFF" />
    <corners android:radius="16dp" />
    <stroke
        android:width="1dp"
        android:color="#E5E7EB" />
</shape>
```

---

## 5. Widget Info XML Files

### res/xml/specific_note_widget_info.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="180dp"
    android:minHeight="180dp"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/widget_specific_note"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:description="@string/widget_note_description" />
```

### res/xml/section_tasks_widget_info.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="180dp"
    android:minHeight="180dp"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/widget_section_tasks"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:description="@string/widget_section_description" />
```

---

## 6. Add to strings.xml

Add these to `res/values/strings.xml`:

```xml
<string name="widget_note_description">Display any note on your home screen</string>
<string name="widget_section_description">Show all tasks from a section</string>
```

---

## 7. Register Widgets in AndroidManifest.xml

Add inside `<application>` tag:

```xml
<!-- Notes Widget -->
<receiver
    android:name=".widgets.SpecificNoteWidget"
    android:exported="true">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
        <action android:name="nota.npd.com.WIDGET_UPDATE" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/specific_note_widget_info" />
</receiver>

<!-- Section Tasks Widget -->
<receiver
    android:name=".widgets.SectionTasksWidget"
    android:exported="true">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
        <action android:name="nota.npd.com.WIDGET_UPDATE" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/section_tasks_widget_info" />
</receiver>

<service
    android:name=".widgets.SectionTasksWidgetService"
    android:permission="android.permission.BIND_REMOTEVIEWS"
    android:exported="false" />
```

---

## How to Add Widgets to Home Screen

1. Enable widgets in the Npd app: Settings → Home Screen Widgets
2. Long press on your Android home screen
3. Tap "Widgets"
4. Find "Npd" widgets
5. Drag the widget you want to your home screen
6. The widget will auto-sync with app data
