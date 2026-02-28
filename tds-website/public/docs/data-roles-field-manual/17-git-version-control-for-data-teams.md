<a name="section-17"></a>
# SECTION 17 — Git & Version Control for Data Teams

Working without Git is like writing a novel without the "Undo" button or the ability to save drafts. Git tracks every change you make to your code (SQL, Python, YAML) so you can collaborate with others safely.

> [!CAUTION]
> Treat your `main` or `master` branch as sacred. It should always contain tested, production-ready code. Always create a new branch (`git checkout -b feature/my-new-model`) for your daily work.

## 17.1 Git Essentials

```bash
# Setup
git config --global user.name "Your Name"
git config --global user.email "you@company.com"

# Daily workflow
git status                          # see changes
git add file.py                     # stage specific file
git add -p                          # stage interactively (review each change)
git commit -m "feat: add orders ETL pipeline"
git push origin feature/orders-etl

# Branching strategy
git checkout -b feature/add-cohort-analysis  # new branch
git checkout main && git pull                 # update main
git merge feature/add-cohort-analysis         # merge
git branch -d feature/add-cohort-analysis     # delete branch

# Undo things
git restore file.py                   # discard unstaged changes
git restore --staged file.py          # unstage
git revert abc1234                    # revert a commit (safe, creates new commit)
git reset --soft HEAD~1               # undo last commit, keep changes staged
git reset --hard HEAD~1               # undo last commit, discard changes (dangerous)

# Stash (temporarily save work)
git stash                             # save current work
git stash pop                         # restore saved work
git stash list                        # see all stashes
```

## 17.2 .gitignore for Data Projects

```gitignore
# .gitignore for data projects

# Secrets — NEVER commit these
.env
.env.*
secrets/
credentials.json
*.pem
*.key

# Data files — usually too large for git
data/raw/
data/processed/
*.csv
*.parquet
*.xlsx
*.pkl
*.joblib

# Jupyter checkpoints
.ipynb_checkpoints/
*/.ipynb_checkpoints/*

# Python
__pycache__/
*.py[cod]
*.egg-info/
dist/
build/
venv/
.venv/
.python-version

# dbt
dbt_packages/
target/
logs/
profiles.yml  # contains passwords — use environment variables

# OS
.DS_Store
Thumbs.db

# IDEs
.idea/
.vscode/
*.swp
```

## 17.3 Git for Data (dvc)

```bash
# DVC — version control for data and models
pip install dvc dvc-s3

dvc init                        # initialize in git repo
dvc add data/raw/orders.csv     # track data file
git add data/raw/orders.csv.dvc .gitignore
git commit -m "Track orders dataset"

# Remote storage
dvc remote add -d s3remote s3://my-bucket/dvc
dvc push                        # upload data to S3
dvc pull                        # download data from S3

# Reproduce pipeline
dvc run -n process_data \
    -d data/raw/orders.csv \
    -d src/process.py \
    -o data/processed/clean_orders.parquet \
    python src/process.py

dvc repro                       # reproduce all pipeline stages
dvc dag                         # show pipeline DAG
```

---

