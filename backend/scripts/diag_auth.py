import http.client, json, sqlite3, os, time

def do_post(path, payload):
    conn=http.client.HTTPConnection('127.0.0.1',8000, timeout=10)
    conn.request('POST', path, body=json.dumps(payload), headers={'Content-Type':'application/json'})
    r=conn.getresponse(); b=r.read()
    try:
        body=json.loads(b)
    except Exception:
        body=b.decode(errors='replace')
    return r.status, body

email=f'diag_user_{int(time.time())}@example.com'
payload={'name':'DiagUser','email':email,'password':'Password1','company':'DiagCo'}
print('Trying signup', payload)
try:
    status, body = do_post('/api/auth/register', payload)
    print('/api/auth/register', status)
    print('body:', body)
except Exception as e:
    print('/api/auth/register error', repr(e))

print('Trying login')
try:
    status2, body2 = do_post('/api/auth/login', {'email':email,'password':'Password1'})
    print('/api/auth/login', status2)
    print('body:', body2)
except Exception as e:
    print('/api/auth/login error', repr(e))

# Inspect sqlite DB if exists
db_path = os.path.join('backend','dev.sqlite3')
print('Checking sqlite DB at', db_path, 'exists=', os.path.exists(db_path))
if os.path.exists(db_path):
    try:
        conn=sqlite3.connect(db_path)
        cur=conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables=cur.fetchall()
        print('tables:', tables)
        try:
            cur.execute('SELECT id, name, email, role, created_at FROM users ORDER BY id DESC LIMIT 5')
            rows=cur.fetchall()
            print('recent users (up to 5):')
            for r in rows:
                print(r)
        except Exception as e:
            print('select users failed:', repr(e))
        conn.close()
    except Exception as e:
        print('sqlite inspect failed', repr(e))
else:
    print('sqlite DB not found')
