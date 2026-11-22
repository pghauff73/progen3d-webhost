"""Export the offline browser projection of a ProGen3D reuse SQLite database."""
from hashlib import sha256
import json
from pathlib import Path
import sqlite3
import sys

def write_database(source, output):
    db = sqlite3.connect(Path(source).resolve().as_uri() + '?mode=ro', uri=True)
    revision = db.execute("SELECT description FROM notes WHERE topic='revision'").fetchone()[0]
    entries = []
    for ref, title, category, search, grammar, digest, mesh in db.execute("""
            SELECT e.ref,e.title,e.category,e.search_text,s.grammar,s.sha256,v.geometry_sha256
            FROM catalogue e JOIN standalone s USING(ref) JOIN verification v USING(ref) ORDER BY e.title,e.ref"""):
        if sha256(grammar.encode()).hexdigest() != digest:
            raise ValueError('Grammar digest mismatch for ' + ref)
        ps=db.execute("""SELECT p.name,p.default_value,p.minimum,p.maximum,p.unit,EXISTS(
            SELECT 1 FROM properties x WHERE x.ref=p.ref AND x.name='integer:'||p.name)
            FROM parameters p WHERE p.ref=? ORDER BY p.ordinal""",(ref,))
        params=[dict(name=n,value=v,min=lo,max=hi,unit=u,integer=bool(i)) for n,v,lo,hi,u,i in ps]
        entries.append(dict(ref=ref,title=title,category=category,search=search,grammar=grammar,parameters=params,sha256=digest,geometry_sha256=mesh))
    if len(entries) != db.execute('SELECT count(*) FROM exports').fetchone()[0]:
        raise ValueError('Missing standalone grammar')
    db.close()
    payload = json.dumps(dict(version=revision,entries=entries),ensure_ascii=True,separators=(',',':')).replace('<','\\u003c')
    Path(output).write_text('const ProGenReuseData = '+payload+';\n')
if __name__=='__main__':write_database(*sys.argv[1:])
