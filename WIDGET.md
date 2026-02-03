# Android Home Screen Widgets for Npd

This guide provides complete Java code templates for implementing native Android widgets for the Npd app. These widgets read data from SharedPreferences that is synced by the Capacitor app.

## Prerequisites

1. Enable widgets in the app via Settings → Home Screen Widgets
2. The app syncs data to SharedPreferences automatically
3. Widgets read from these SharedPreferences keys:
   - `npd_widget_tasks` - Task list data
   - `npd_widget_notes` - Notes list data  
   - `npd_widget_notes_by_type` - Notes grouped by type
   - `npd_widget_sections` - Sections with tasks
   - `npd_widget_config` - Widget configuration
   - `npd_widget_note_{id}` - Specific note data

## Project Structure

Add these files to your Android project:

```
android/app/src/main/
├── java/app/lovable/{your_package}/
│   ├── widgets/
│   │   ├── TaskListWidget.java
│   │   ├── TaskInputWidget.java
│   │   ├── NoteTypeWidget.java
│   │   ├── SpecificNoteWidget.java
│   │   ├── SectionTasksWidget.java
│   │   └── WidgetDataHelper.java
├── res/
│   ├── layout/
│   │   ├── widget_task_list.xml
│   │   ├── widget_task_input.xml
│   │   ├── widget_note_type.xml
│   │   ├── widget_specific_note.xml
│   │   ├── widget_section_tasks.xml
│   │   └── widget_task_item.xml
│   ├── xml/
│   │   ├── task_list_widget_info.xml
│   │   ├── task_input_widget_info.xml
│   │   ├── note_type_widget_info.xml
│   │   ├── specific_note_widget_info.xml
│   │   └── section_tasks_widget_info.xml
│   └── drawable/
│       └── widget_background.xml
```

---

## 1. Widget Data Helper (Shared Utility)

Create `WidgetDataHelper.java`:

```java
package app.lovable.YOUR_PACKAGE.widgets;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

public class WidgetDataHelper {
    
    // SharedPreferences name used by Capacitor Preferences plugin
    private static final String PREFS_NAME = "CapacitorStorage";
    
    // Widget data keys (must match widgetDataSync.ts)
    private static final String KEY_TASKS = "npd_widget_tasks";
    private static final String KEY_NOTES = "npd_widget_notes";
    private static final String KEY_NOTES_BY_TYPE = "npd_widget_notes_by_type";
    private static final String KEY_SECTIONS = "npd_widget_sections";
    private static final String KEY_CONFIG = "npd_widget_config";
    
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
     * Get all tasks for widget display
     */
    public static List<Task> getTasks(Context context) {
        List<Task> tasks = new ArrayList<>();
        try {
            String json = getPrefs(context).getString(KEY_TASKS, "{}");
            JSONObject data = new JSONObject(json);
            JSONArray tasksArray = data.optJSONArray("tasks");
            
            if (tasksArray != null) {
                for (int i = 0; i < tasksArray.length(); i++) {
                    JSONObject taskObj = tasksArray.getJSONObject(i);
                    Task task = new Task();
                    task.id = taskObj.optString("id");
                    task.text = taskObj.optString("text");
                    task.completed = taskObj.optBoolean("completed", false);
                    task.priority = taskObj.optString("priority", "none");
                    task.dueDate = taskObj.optString("dueDate", null);
                    task.sectionId = taskObj.optString("sectionId", null);
                    tasks.add(task);
                }
            }
        } catch (JSONException e) {
            e.printStackTrace();
        }
        return tasks;
    }
    
    /**
     * Get notes by type (regular, sticky, lined, code, sketch)
     */
    public static List<Note> getNotesByType(Context context, String noteType) {
        List<Note> notes = new ArrayList<>();
        try {
            String json = getPrefs(context).getString(KEY_NOTES_BY_TYPE, "{}");
            JSONObject data = new JSONObject(json);
            JSONArray notesArray = data.optJSONArray(noteType);
            
            if (notesArray != null) {
                for (int i = 0; i < notesArray.length(); i++) {
                    JSONObject noteObj = notesArray.getJSONObject(i);
                    Note note = new Note();
                    note.id = noteObj.optString("id");
                    note.title = noteObj.optString("title");
                    note.content = noteObj.optString("content");
                    note.type = noteObj.optString("type");
                    note.color = noteObj.optString("color", null);
                    notes.add(note);
                }
            }
        } catch (JSONException e) {
            e.printStackTrace();
        }
        return notes;
    }
    
    /**
     * Get all notes for dropdown widget
     */
    public static List<Note> getAllNotes(Context context) {
        List<Note> notes = new ArrayList<>();
        try {
            String json = getPrefs(context).getString(KEY_NOTES, "{}");
            JSONObject data = new JSONObject(json);
            JSONArray notesArray = data.optJSONArray("notes");
            
            if (notesArray != null) {
                for (int i = 0; i < notesArray.length(); i++) {
                    JSONObject noteObj = notesArray.getJSONObject(i);
                    Note note = new Note();
                    note.id = noteObj.optString("id");
                    note.title = noteObj.optString("title");
                    note.type = noteObj.optString("type");
                    note.content = noteObj.optString("preview");
                    notes.add(note);
                }
            }
        } catch (JSONException e) {
            e.printStackTrace();
        }
        return notes;
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
            case "high": return 0xFFEF4444; // Red
            case "medium": return 0xFFF59E0B; // Orange
            case "low": return 0xFF3B82F6; // Blue
            default: return 0xFF6B7280; // Gray
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

## 2. Task List Widget

### TaskListWidget.java

```java
package app.lovable.YOUR_PACKAGE.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import app.lovable.YOUR_PACKAGE.MainActivity;
import app.lovable.YOUR_PACKAGE.R;

import java.util.List;

public class TaskListWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_task_list);

        // Set up the intent for the list view service
        Intent intent = new Intent(context, TaskListWidgetService.class);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        intent.setData(Uri.parse(intent.toUri(Intent.URI_INTENT_SCHEME)));
        
        views.setRemoteAdapter(R.id.task_list, intent);
        views.setEmptyView(R.id.task_list, R.id.empty_view);

        // Set up click to open app
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.putExtra("route", "/todo/today");
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, openAppIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_header, pendingIntent);

        // Set up add button
        Intent addIntent = new Intent(context, MainActivity.class);
        addIntent.putExtra("action", "add_task");
        PendingIntent addPendingIntent = PendingIntent.getActivity(context, 1, addIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.add_task_button, addPendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        
        // Handle widget data updates
        if ("app.lovable.WIDGET_UPDATE".equals(intent.getAction())) {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(
                new android.content.ComponentName(context, TaskListWidget.class));
            appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetIds, R.id.task_list);
        }
    }
}

// RemoteViewsService for the list
class TaskListWidgetService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new TaskListRemoteViewsFactory(this.getApplicationContext());
    }
}

// RemoteViewsFactory to populate list items
class TaskListRemoteViewsFactory implements RemoteViewsService.RemoteViewsFactory {
    private Context context;
    private List<WidgetDataHelper.Task> tasks;

    TaskListRemoteViewsFactory(Context context) {
        this.context = context;
    }

    @Override
    public void onCreate() {
        tasks = WidgetDataHelper.getTasks(context);
    }

    @Override
    public void onDataSetChanged() {
        tasks = WidgetDataHelper.getTasks(context);
    }

    @Override
    public void onDestroy() {
        tasks = null;
    }

    @Override
    public int getCount() {
        return tasks != null ? Math.min(tasks.size(), 10) : 0;
    }

    @Override
    public RemoteViews getViewAt(int position) {
        if (tasks == null || position >= tasks.size()) {
            return null;
        }

        WidgetDataHelper.Task task = tasks.get(position);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_task_item);
        
        views.setTextViewText(R.id.task_text, task.text);
        views.setInt(R.id.priority_indicator, "setBackgroundColor", 
            WidgetDataHelper.getPriorityColor(task.priority));

        // Set up click intent
        Intent fillInIntent = new Intent();
        fillInIntent.putExtra("taskId", task.id);
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

### res/layout/widget_task_list.xml

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
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:text="✅ Tasks"
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
        android:id="@+id/task_list"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:divider="@null"
        android:dividerHeight="4dp" />

    <TextView
        android:id="@+id/empty_view"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:gravity="center"
        android:text="No tasks"
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
        android:id="@+id/task_text"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:textSize="14sp"
        android:textColor="#374151"
        android:maxLines="2"
        android:ellipsize="end" />
</LinearLayout>
```

### res/xml/task_list_widget_info.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="180dp"
    android:minHeight="180dp"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/widget_task_list"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:previewImage="@drawable/widget_preview_tasks"
    android:description="@string/widget_tasks_description" />
```

---

## 3. Quick Add Task Widget

### TaskInputWidget.java

```java
package app.lovable.YOUR_PACKAGE.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import app.lovable.YOUR_PACKAGE.MainActivity;
import app.lovable.YOUR_PACKAGE.R;

public class TaskInputWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_task_input);

            // Open app with task input action
            Intent intent = new Intent(context, MainActivity.class);
            intent.putExtra("action", "add_task");
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            
            PendingIntent pendingIntent = PendingIntent.getActivity(context, appWidgetId, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            views.setOnClickPendingIntent(R.id.widget_container, pendingIntent);
            views.setOnClickPendingIntent(R.id.input_field, pendingIntent);

            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }
}
```

### res/layout/widget_task_input.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_container"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="horizontal"
    android:background="@drawable/widget_background"
    android:padding="12dp"
    android:gravity="center_vertical">

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="➕"
        android:textSize="20sp"
        android:layout_marginEnd="12dp" />

    <TextView
        android:id="@+id/input_field"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Add a task..."
        android:textSize="14sp"
        android:textColor="#9CA3AF"
        android:background="#F3F4F6"
        android:padding="12dp"
        android:singleLine="true" />
</LinearLayout>
```

---

## 4. Note Type Widget (Regular, Sticky, Lined, Code, Sketch)

### NoteTypeWidget.java

```java
package app.lovable.YOUR_PACKAGE.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import app.lovable.YOUR_PACKAGE.MainActivity;
import app.lovable.YOUR_PACKAGE.R;

import java.util.List;

public class NoteTypeWidget extends AppWidgetProvider {

    private static final String PREFS_NAME = "NoteTypeWidgetPrefs";
    private static final String PREF_NOTE_TYPE = "note_type_";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        // Get configured note type for this widget
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String noteType = prefs.getString(PREF_NOTE_TYPE + appWidgetId, "regular");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_note_type);

        // Set header based on type
        String icon = WidgetDataHelper.getNoteTypeIcon(noteType);
        String typeName = noteType.substring(0, 1).toUpperCase() + noteType.substring(1) + " Notes";
        views.setTextViewText(R.id.widget_title, icon + " " + typeName);

        // Get notes of this type
        List<WidgetDataHelper.Note> notes = WidgetDataHelper.getNotesByType(context, noteType);

        // Display first note preview
        if (!notes.isEmpty()) {
            WidgetDataHelper.Note note = notes.get(0);
            views.setTextViewText(R.id.note_title, note.title);
            views.setTextViewText(R.id.note_preview, note.content);
            views.setViewVisibility(R.id.note_content, android.view.View.VISIBLE);
            views.setViewVisibility(R.id.empty_view, android.view.View.GONE);
        } else {
            views.setViewVisibility(R.id.note_content, android.view.View.GONE);
            views.setViewVisibility(R.id.empty_view, android.view.View.VISIBLE);
        }

        // Click to open app with note type
        Intent intent = new Intent(context, MainActivity.class);
        intent.putExtra("action", "add_note_" + noteType);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(context, appWidgetId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        views.setOnClickPendingIntent(R.id.widget_container, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    // Call this to set the note type for a widget during configuration
    public static void setNoteType(Context context, int appWidgetId, String noteType) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(PREF_NOTE_TYPE + appWidgetId, noteType).apply();
    }
}
```

### res/layout/widget_note_type.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_container"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:background="@drawable/widget_background"
    android:padding="12dp">

    <TextView
        android:id="@+id/widget_title"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="📄 Notes"
        android:textSize="16sp"
        android:textStyle="bold"
        android:textColor="#1F2937"
        android:paddingBottom="8dp" />

    <LinearLayout
        android:id="@+id/note_content"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:orientation="vertical"
        android:visibility="visible">

        <TextView
            android:id="@+id/note_title"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:textSize="14sp"
            android:textStyle="bold"
            android:textColor="#374151"
            android:maxLines="1"
            android:ellipsize="end" />

        <TextView
            android:id="@+id/note_preview"
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:textSize="12sp"
            android:textColor="#6B7280"
            android:paddingTop="4dp" />
    </LinearLayout>

    <TextView
        android:id="@+id/empty_view"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:gravity="center"
        android:text="Tap to create a note"
        android:textColor="#9CA3AF"
        android:visibility="gone" />
</LinearLayout>
```

---

## 5. Specific Note Widget

### SpecificNoteWidget.java

```java
package app.lovable.YOUR_PACKAGE.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import app.lovable.YOUR_PACKAGE.MainActivity;
import app.lovable.YOUR_PACKAGE.R;

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
                        int color = android.graphics.Color.parseColor(note.color);
                        views.setInt(R.id.widget_container, "setBackgroundColor", color);
                    } catch (Exception e) {
                        // Use default
                    }
                }
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
}
```

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

---

## 6. Section Tasks Widget

### SectionTasksWidget.java

```java
package app.lovable.YOUR_PACKAGE.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import app.lovable.YOUR_PACKAGE.MainActivity;
import app.lovable.YOUR_PACKAGE.R;

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
            if (section.id.equals(sectionId)) {
                targetSection = section;
                break;
            }
        }

        if (targetSection != null) {
            views.setTextViewText(R.id.section_name, "📋 " + targetSection.name);
            
            // Build task list text
            StringBuilder tasksText = new StringBuilder();
            int count = 0;
            for (WidgetDataHelper.Task task : targetSection.tasks) {
                if (count >= 5) break;
                String checkbox = task.completed ? "☑" : "☐";
                tasksText.append(checkbox).append(" ").append(task.text).append("\n");
                count++;
            }
            
            if (tasksText.length() > 0) {
                views.setTextViewText(R.id.tasks_list, tasksText.toString().trim());
                views.setViewVisibility(R.id.tasks_list, android.view.View.VISIBLE);
                views.setViewVisibility(R.id.empty_view, android.view.View.GONE);
            } else {
                views.setViewVisibility(R.id.tasks_list, android.view.View.GONE);
                views.setViewVisibility(R.id.empty_view, android.view.View.VISIBLE);
                views.setTextViewText(R.id.empty_view, "No tasks in this section");
            }
        } else {
            views.setTextViewText(R.id.section_name, "📋 Section");
            views.setViewVisibility(R.id.tasks_list, android.view.View.GONE);
            views.setViewVisibility(R.id.empty_view, android.view.View.VISIBLE);
            views.setTextViewText(R.id.empty_view, "Select a section in app settings");
        }

        // Click to open app
        Intent intent = new Intent(context, MainActivity.class);
        intent.putExtra("route", "/todo/today");
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(context, appWidgetId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        views.setOnClickPendingIntent(R.id.widget_container, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    public static void setSectionId(Context context, int appWidgetId, String sectionId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(PREF_SECTION_ID + appWidgetId, sectionId).apply();
    }
}
```

### res/layout/widget_section_tasks.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_container"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:background="@drawable/widget_background"
    android:padding="12dp">

    <TextView
        android:id="@+id/section_name"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="📋 Section"
        android:textSize="16sp"
        android:textStyle="bold"
        android:textColor="#1F2937"
        android:paddingBottom="8dp" />

    <TextView
        android:id="@+id/tasks_list"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:textSize="13sp"
        android:textColor="#374151"
        android:lineSpacingMultiplier="1.4" />

    <TextView
        android:id="@+id/empty_view"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:gravity="center"
        android:text="No tasks"
        android:textColor="#9CA3AF"
        android:visibility="gone" />
</LinearLayout>
```

---

## 7. Widget Background Drawable

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

## 8. Register Widgets in AndroidManifest.xml

Add these inside the `<application>` tag:

```xml
<!-- Task List Widget -->
<receiver
    android:name=".widgets.TaskListWidget"
    android:exported="true">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
        <action android:name="app.lovable.WIDGET_UPDATE" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/task_list_widget_info" />
</receiver>

<service
    android:name=".widgets.TaskListWidgetService"
    android:permission="android.permission.BIND_REMOTEVIEWS"
    android:exported="false" />

<!-- Task Input Widget -->
<receiver
    android:name=".widgets.TaskInputWidget"
    android:exported="true">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/task_input_widget_info" />
</receiver>

<!-- Note Type Widget -->
<receiver
    android:name=".widgets.NoteTypeWidget"
    android:exported="true">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
        <action android:name="app.lovable.WIDGET_UPDATE" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/note_type_widget_info" />
</receiver>

<!-- Specific Note Widget -->
<receiver
    android:name=".widgets.SpecificNoteWidget"
    android:exported="true">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
        <action android:name="app.lovable.WIDGET_UPDATE" />
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
        <action android:name="app.lovable.WIDGET_UPDATE" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/section_tasks_widget_info" />
</receiver>
```

---

## 9. Handle Widget Actions in MainActivity

Add this to your `MainActivity.java` `onCreate` or a helper method:

```java
@Override
protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    
    // Handle widget intents
    handleWidgetIntent(getIntent());
}

@Override
protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    handleWidgetIntent(intent);
}

private void handleWidgetIntent(Intent intent) {
    if (intent == null) return;
    
    String action = intent.getStringExtra("action");
    String route = intent.getStringExtra("route");
    
    if (action != null) {
        // Store action for the web app to read
        android.content.SharedPreferences prefs = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
        prefs.edit().putString("pendingNotificationAction", action).apply();
        
        // For specific note opening
        String noteId = intent.getStringExtra("noteId");
        if (noteId != null) {
            prefs.edit().putString("pendingNoteId", noteId).apply();
        }
    }
    
    if (route != null) {
        // Navigate to specific route (handled by web app)
        android.content.SharedPreferences prefs = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
        prefs.edit().putString("pendingRoute", route).apply();
    }
}
```

---

## 10. Trigger Widget Updates from Web App

The `widgetDataSync.ts` already dispatches a `widgetDataUpdated` event. To trigger native widget refresh, you can add a Capacitor plugin or use a broadcast:

```java
// In a Capacitor plugin or helper
public void notifyWidgetsToUpdate(Context context) {
    Intent intent = new Intent("app.lovable.WIDGET_UPDATE");
    context.sendBroadcast(intent);
}
```

---

## Summary

1. **Copy the Java files** to your `android/app/src/main/java/...` directory
2. **Copy the XML layouts** to `android/app/src/main/res/layout/`
3. **Copy the widget info XMLs** to `android/app/src/main/res/xml/`
4. **Add the drawable** to `android/app/src/main/res/drawable/`
5. **Register widgets** in `AndroidManifest.xml`
6. **Handle intents** in `MainActivity.java`
7. Run `npx cap sync android` to sync changes
8. Build and test!

The widgets will automatically read data from SharedPreferences that the Capacitor app syncs via the `widgetDataSync` utility.
