import os
import re

print("Running split script...")
with open('public/docs/data-roles-field-manual.md', 'r', encoding='utf-8') as f:
    text = f.read()

# Pattern finds:
# <a name="section-XX"></a>
# # SECTION XX — Title Text
pattern = re.compile(r'(<a name="section-\d+"></a>\s*#+ [^\n]+)', re.IGNORECASE)

sections = pattern.split(text)

# sections[0] is everything before the first section
intro = sections[0].strip()
os.makedirs('public/docs/data-roles-field-manual', exist_ok=True)
with open('public/docs/data-roles-field-manual/00-intro.md', 'w', encoding='utf-8') as f:
    f.write(intro)

print("Wrote Intro")

# Pairs of (Header_Match, Content) start at sections[1]
for i in range(1, len(sections), 2):
    header = sections[i]
    content = sections[i+1] if i+1 < len(sections) else ""
    
    # extract title text "SECTION 0 — The Data Stack in 2026"
    title_match = re.search(r'#+ SECTION \d+\s*—\s*([^\n]+)', header, re.IGNORECASE)
    title = title_match.group(1) if title_match else f"Section_{i}"
    
    # Format filename
    filename = f'{(i//2):02d}-' + re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-') + '.md'
    filepath = os.path.join('public/docs/data-roles-field-manual', filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(header + content)
        
    print(f'Wrote {filepath}')

