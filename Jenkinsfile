// Auto-deploy on every push to main — no Build with Parameters needed.
//
 // testman (Jenkins :8081) → ssh tesbo → git pull + docker compose up --build -d
 // Uses system SSH on testman (jenkins user). No Jenkins SSH credential.
 // Never runs: docker compose down -v

pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  // Auto trigger: GitHub webhook (preferred) + poll fallback
  triggers {
    pollSCM('H/2 * * * *')
  }

  environment {
    REPO_URL    = 'https://github.com/QAbleHQ/Tesbo-Test-Manager-Private.git'
    APP_HEALTH  = 'https://app.tesbo.io'
    DEPLOY_HOST = 'tesbo'
    DEPLOY_USER = 'root'
    DEPLOY_PATH = '/opt/tesbo-test-manager/Tesbo-Test-Manager'
  }

  stages {
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

          ssh ${SSH_OPTS} "${DEPLOY_USER}@${DEPLOY_HOST}" bash -s <<EOF
set -eu
cd "${DEPLOY_PATH}"
git remote set-url origin "${REPO_URL}"
git fetch origin main
git checkout -f main
git reset --hard origin/main
git log -1 --oneline

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "Docker Compose not found on tesbo" >&2
  exit 1
fi

\$COMPOSE down
\$COMPOSE up --build -d
sleep 15
\$COMPOSE ps
curl -fsS "http://127.0.0.1:1011/health" || curl -fsS "http://127.0.0.1:7000/health" || true
echo "==> Deploy finished"
EOF
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
      echo "Auto-deploy failed. On testman run: sudo -u jenkins ssh tesbo hostname"
    }
  }
}
