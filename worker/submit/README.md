### New table

```sql
CREATE TABLE IF NOT EXISTS submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, contact TEXT, title TEXT, tags TEXT DEFAULT '[]', description TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, r2_prefix TEXT NOT NULL UNIQUE, approved INTEGER NOT NULL DEFAULT 0, published_commit TEXT NOT NULL DEFAULT '');
```

### Existing table without commit ID

```sql
ALTER TABLE submissions ADD COLUMN published_commit TEXT NOT NULL DEFAULT '';
```
