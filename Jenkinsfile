// Auto-deploy Tesbo Test Manager (Private) on pushes to main.
//
// Failure you hit:
//   ERROR: Could not find credentials entry with ID 'tesbo-deploy-ssh'
// Fix in Jenkins GUI (one time):
//   Manage Jenkins → Credentials → Global → Add Credentials
//   Kind: SSH Username with private key
//   ID: tesbo-deploy-ssh   (must match exactly, or change param below)
//   Username: root (or deploy user)
//   Private Key: key that can SSH to the app server
//
// Also set job env or use Build Parameters:
//   DEPLOY_HOST = production server IP / hostname
//   DEPLOY_USER = root
//
// Safety: never runs `docker compose down -v` (keeps Postgres data).

pipeline {
  agent any

  parameters {
    choice(
      name: 'DEPLOY_MODE',
      choices: ['ssh', 'local'],
      description: 'ssh = deploy over SSH to DEPLOY_HOST. local = run docker compose on this Jenkins agent (only if Jenkins runs on the app server).'
    )
    string(
      name: 'DEPLOY_HOST',
      defaultValue: '',
      description: 'Required for ssh mode. App server IP or hostname (e.g. tesbo or 208.x.x.x).'
    )
    string(
      name: 'DEPLOY_USER',
      defaultValue: 'root',
      description: 'SSH username on the app server.'
    )
    string(
      name: 'DEPLOY_SSH_CREDENTIAL_ID',
      defaultValue: 'tesbo-deploy-ssh',
      description: 'Jenkins credential ID (SSH Username with private key). Create this in Jenkins if missing.'
    )
    string(
      name: 'DEPLOY_PATH',
      defaultValue: '/opt/tesbo-test-manager/Tesbo-Test-Manager',
      description: 'App directory on the production server.'
    )
  }

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  triggers {
    pollSCM('H/2 * * * *')
  }

  environment {
    REPO_URL   = 'https://github.com/QAbleHQ/Tesbo-Test-Manager-Private.git'
    APP_HEALTH = "${env.APP_HEALTH ?: 'https://app.tesbo.io'}"
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
          echo "DEPLOY_MODE=${params.DEPLOY_MODE} HOST=${params.DEPLOY_HOST} CRED=${params.DEPLOY_SSH_CREDENTIAL_ID}"
        }
      }
    }

    stage('Deploy (local)') {
      when {
        allOf {
          anyOf {
            branch 'main'
            expression { env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' || env.GIT_BRANCH == 'main' }
          }
          expression { params.DEPLOY_MODE == 'local' }
        }
      }
      steps {
        sh '''
          set -eu
          REMOTE_PATH="${DEPLOY_PATH}"
          echo "==> Local deploy at ${REMOTE_PATH}"
          cd "${REMOTE_PATH}"

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
            echo "Docker Compose not found" >&2
            exit 1
          fi

          $COMPOSE down
          $COMPOSE up --build -d
          sleep 15
          $COMPOSE ps
          curl -fsS "http://127.0.0.1:1011/health" || curl -fsS "http://127.0.0.1:7000/health" || true
        '''
      }
    }

    stage('Deploy (ssh)') {
      when {
        allOf {
          anyOf {
            branch 'main'
            expression { env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' || env.GIT_BRANCH == 'main' }
          }
          expression { params.DEPLOY_MODE == 'ssh' }
        }
      }
      steps {
        script {
          if (!params.DEPLOY_HOST?.trim()) {
            error('DEPLOY_HOST is empty. Set it in Build with Parameters (or job defaults) to your app server hostname/IP.')
          }
        }
        withCredentials([
          sshUserPrivateKey(
            credentialsId: "${params.DEPLOY_SSH_CREDENTIAL_ID}",
            keyFileVariable: 'SSH_KEY',
            usernameVariable: 'SSH_USER'
          )
        ]) {
          sh '''
            set -eu

            HOST="${DEPLOY_HOST}"
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
      echo """
Deploy failed.
If error is missing credentials:
  1) Jenkins → Manage Jenkins → Credentials → Global → Add Credentials
  2) Kind: SSH Username with private key
  3) ID must be exactly: tesbo-deploy-ssh  (or match DEPLOY_SSH_CREDENTIAL_ID)
  4) Also set DEPLOY_HOST in Build with Parameters
"""
    }
  }
}
