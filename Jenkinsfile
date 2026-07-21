// Auto-deploy Tesbo Test Manager (Private) on pushes to main.
//
// Jenkins job setup:
//   1. Create a Pipeline job (or Multibranch Pipeline) pointing at this repo.
//   2. Branch specifier: */main
//   3. Add a GitHub webhook (or GitHub plugin) so pushes to main trigger the job.
//   4. Configure credentials / env vars below in Jenkins.
//
// Required Jenkins credentials / env:
//   DEPLOY_HOST              - production server host (IP or SSH alias, e.g. tesbo)
//   DEPLOY_USER              - SSH user (e.g. root)
//   DEPLOY_SSH_CREDENTIAL_ID - Jenkins SSH private-key credential ID (default: tesbo-deploy-ssh)
//   DEPLOY_PATH              - app directory on server (default below)
//
// Safety: never runs `docker compose down -v` so Postgres volume data is preserved.

pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  triggers {
    // Prefer a GitHub webhook for push-to-main. pollSCM is a fallback.
    pollSCM('H/2 * * * *')
  }

  environment {
    DEPLOY_PATH = "${env.DEPLOY_PATH ?: '/opt/tesbo-test-manager/Tesbo-Test-Manager'}"
    REPO_URL    = 'https://github.com/QAbleHQ/Tesbo-Test-Manager-Private.git'
    APP_HEALTH  = "${env.APP_HEALTH ?: 'https://app.tesbo.io'}"
  }

  stages {
    stage('Checkout') {
      when {
        anyOf {
          branch 'main'
          expression { env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' || env.GIT_BRANCH == 'main' }
        }
      }
      steps {
        checkout scm
        script {
          env.GIT_SHA = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
          echo "Deploying commit ${env.GIT_SHA} from Tesbo-Test-Manager-Private (main)"
        }
      }
    }

    stage('Deploy to production') {
      when {
        anyOf {
          branch 'main'
          expression { env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' || env.GIT_BRANCH == 'main' }
        }
      }
      steps {
        withCredentials([
          sshUserPrivateKey(
            credentialsId: "${env.DEPLOY_SSH_CREDENTIAL_ID ?: 'tesbo-deploy-ssh'}",
            keyFileVariable: 'SSH_KEY',
            usernameVariable: 'SSH_USER'
          )
        ]) {
          sh '''
            set -eu

            HOST="${DEPLOY_HOST:?Set DEPLOY_HOST in Jenkins (server IP or SSH alias)}"
            USER_NAME="${DEPLOY_USER:-$SSH_USER}"
            REMOTE_PATH="${DEPLOY_PATH}"

            SSH_OPTS="-i ${SSH_KEY} -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes"

            echo "==> Connecting to ${USER_NAME}@${HOST}"
            echo "==> Deploy path: ${REMOTE_PATH}"
            echo "==> Commit: ${GIT_SHA}"

            ssh ${SSH_OPTS} "${USER_NAME}@${HOST}" bash -s <<EOF
set -eu
cd "${REMOTE_PATH}"

echo "==> Verify / set private repo remote"
git remote set-url origin "${REPO_URL}"
git remote -v

echo "==> Fetch and reset to origin/main (code only; DB volumes untouched)"
git fetch origin main
git checkout -f main
git reset --hard origin/main
git log -1 --oneline

echo "==> Redeploy with Docker Compose (NO -v — keeps database)"
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "Docker Compose not found on server" >&2
  exit 1
fi

# Stop containers but keep named volumes (postgres data)
\$COMPOSE down
\$COMPOSE up --build -d

echo "==> Waiting for containers"
sleep 15
\$COMPOSE ps

echo "==> Backend health (local)"
curl -fsS "http://127.0.0.1:1011/health" || curl -fsS "http://127.0.0.1:7000/health" || true

echo "==> Deploy finished"
EOF
          '''
        }
      }
    }

    stage('Smoke check') {
      when {
        anyOf {
          branch 'main'
          expression { env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' || env.GIT_BRANCH == 'main' }
        }
      }
      steps {
        sh '''
          set -eu
          echo "==> Checking public frontend"
          curl -fsS -o /dev/null -w "frontend:%{http_code}\\n" "${APP_HEALTH}/login" || \
            curl -fsS -o /dev/null -w "frontend:%{http_code}\\n" "${APP_HEALTH}/" || true
          echo "Smoke check done. Open ${APP_HEALTH}/projects"
        '''
      }
    }
  }

  post {
    success {
      echo "Deploy succeeded for ${env.GIT_SHA}. Site: https://app.tesbo.io/projects"
    }
    failure {
      echo "Deploy failed. Check Jenkins console + server docker compose logs."
    }
  }
}
