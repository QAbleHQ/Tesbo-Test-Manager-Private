// Auto-deploy ONLY when code is pushed to main.
// Trigger: GitHub webhook → Jenkins (GitHub hook trigger).
 // No pollSCM — avoids random rebuilds; deploy runs on push to main only.
 // testman → ssh tesbo → git pull + docker compose up --build -d
 // Never runs: docker compose down -v

pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  // Do NOT use pollSCM. Use GitHub webhook only (job: GitHub hook trigger).
  // Job SCM branch must be */main so only main pushes start this pipeline.

  environment {
    REPO_URL    = 'https://github.com/QAbleHQ/Tesbo-Test-Manager-Private.git'
    APP_HEALTH  = 'https://app.tesbo.io'
    DEPLOY_HOST = 'tesbo'
    DEPLOY_USER = 'root'
    DEPLOY_PATH = '/opt/tesbo-test-manager/Tesbo-Test-Manager'
  }

  stages {
    stage('Guard: main only') {
      steps {
        script {
          def branch = (env.BRANCH_NAME ?: env.GIT_BRANCH ?: '').replaceAll('^origin/', '')
          echo "Detected branch: '${branch}' (BRANCH_NAME=${env.BRANCH_NAME}, GIT_BRANCH=${env.GIT_BRANCH})"
          // Freestyle Pipeline-from-SCM on */main usually has empty BRANCH_NAME;
          // still verify we checked out main tip.
          def headBranch = sh(
            script: "git rev-parse --abbrev-ref HEAD || true",
            returnStdout: true
          ).trim()
          def onMain = (branch == 'main' || headBranch == 'main' || branch == '' || branch == null)
          if (headBranch && headBranch != 'main' && headBranch != 'HEAD') {
            error("Refusing deploy: not on main (HEAD is '${headBranch}'). Push to main only.")
          }
          if (branch && branch != 'main' && branch != 'HEAD') {
            error("Refusing deploy: branch is '${branch}'. This pipeline runs only for main.")
          }
          echo "OK — main branch deploy allowed"
        }
      }
    }

    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.GIT_SHA = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
          echo "Auto-deploy ${env.GIT_SHA} → ${env.DEPLOY_USER}@${env.DEPLOY_HOST}:${env.DEPLOY_PATH}"
        }
      }
    }

    stage('Deploy via ssh tesbo') {
      steps {
        sh '''
          set -eu
          SSH_OPTS="-o BatchMode=yes -o StrictHostKeyChecking=accept-new"

          echo "==> Jenkins user on testman: $(whoami)"
          echo "==> SSH check ${DEPLOY_USER}@${DEPLOY_HOST}"
          ssh ${SSH_OPTS} "${DEPLOY_USER}@${DEPLOY_HOST}" "hostname && pwd"

          ssh ${SSH_OPTS} "${DEPLOY_USER}@${DEPLOY_HOST}" \
            "export DEPLOY_PATH='${DEPLOY_PATH}' REPO_URL='${REPO_URL}'; bash -s" <<'REMOTE'
set -eu
cd "$DEPLOY_PATH"
git remote set-url origin "$REPO_URL"
git fetch origin main
git checkout -f main
git reset --hard origin/main
git log -1 --oneline

if docker compose version >/dev/null 2>&1; then
  docker compose down
  docker compose up --build -d
  sleep 15
  docker compose ps
elif command -v docker-compose >/dev/null 2>&1; then
  docker-compose down
  docker-compose up --build -d
  sleep 15
  docker-compose ps
else
  echo "Docker Compose not found on tesbo" >&2
  exit 1
fi

curl -fsS "http://127.0.0.1:1011/health" || curl -fsS "http://127.0.0.1:7000/health" || true
echo "==> Deploy finished"
REMOTE
        '''
      }
    }

    stage('Smoke check') {
      steps {
        sh '''
          set -eu
          curl -fsS -o /dev/null -w "frontend:%{http_code}\\n" "${APP_HEALTH}/login" || \
            curl -fsS -o /dev/null -w "frontend:%{http_code}\\n" "${APP_HEALTH}/" || true
          echo "Site: ${APP_HEALTH}/projects"
        '''
      }
    }
  }

  post {
    success {
      echo "Auto-deploy OK: ${env.GIT_SHA} → https://app.tesbo.io/projects"
    }
    failure {
      echo "Auto-deploy failed. On testman: sudo -u jenkins ssh tesbo hostname"
    }
  }
}
