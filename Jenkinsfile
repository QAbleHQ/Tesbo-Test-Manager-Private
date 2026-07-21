// Auto-deploy Tesbo Test Manager (Private) on pushes to main.
//
 // Architecture:
//   Jenkins server = testman
//   App server     = tesbo  (SSH host alias from testman; no droplet IP needed)
//
 // Deploy flow: Jenkins SSHes to `tesbo`, pulls main, docker compose up --build -d
 // Safety: never runs `docker compose down -v` (keeps Postgres data).
 //
 // One-time Jenkins credential:
 //   Manage Jenkins → Credentials → Global → Add Credentials
 //   Kind: SSH Username with private key
 //   ID: tesbo-deploy-ssh
 //   Username: root
 //   Private Key: the key testman uses for `ssh tesbo`

pipeline {
  agent any

  parameters {
    choice(
      name: 'DEPLOY_MODE',
      choices: ['ssh', 'local'],
      description: 'ssh = deploy to tesbo over SSH (normal). local = only if app runs on Jenkins/testman itself.'
    )
    string(
      name: 'DEPLOY_HOST',
      defaultValue: 'tesbo',
      description: 'SSH host alias from testman (default: tesbo). Not a droplet IP.'
    )
    string(
      name: 'DEPLOY_USER',
      defaultValue: 'root',
      description: 'SSH username on tesbo.'
    )
    string(
      name: 'DEPLOY_SSH_CREDENTIAL_ID',
      defaultValue: 'tesbo-deploy-ssh',
      description: 'Jenkins SSH credential ID used to connect testman → tesbo.'
    )
    string(
      name: 'DEPLOY_PATH',
      defaultValue: '/opt/tesbo-test-manager/Tesbo-Test-Manager',
      description: 'App directory on tesbo.'
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
    REPO_URL    = 'https://github.com/QAbleHQ/Tesbo-Test-Manager-Private.git'
    APP_HEALTH  = "${env.APP_HEALTH ?: 'https://app.tesbo.io'}"
    DEPLOY_PATH = "${params.DEPLOY_PATH}"
    DEPLOY_HOST = "${params.DEPLOY_HOST}"
    DEPLOY_USER = "${params.DEPLOY_USER}"
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
          echo "DEPLOY_MODE=${params.DEPLOY_MODE} HOST=${params.DEPLOY_HOST} PATH=${params.DEPLOY_PATH}"
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
          echo "==> Local deploy at ${DEPLOY_PATH}"
          test -d "${DEPLOY_PATH}" || { echo "ERROR: ${DEPLOY_PATH} not found on testman. Use DEPLOY_MODE=ssh to deploy on tesbo."; exit 1; }
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
        withCredentials([
          sshUserPrivateKey(
            credentialsId: "${params.DEPLOY_SSH_CREDENTIAL_ID}",
            keyFileVariable: 'SSH_KEY',
            usernameVariable: 'SSH_USER'
          )
        ]) {
          sh '''
            set -eu
            USER_NAME="${DEPLOY_USER:-$SSH_USER}"
            SSH_OPTS="-i ${SSH_KEY} -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes"

            echo "==> Connecting to ${USER_NAME}@${DEPLOY_HOST}"
            echo "==> Deploy path: ${DEPLOY_PATH}"
            echo "==> Commit: ${GIT_SHA}"

            # Quick connectivity check (same path Jenkins will use)
            ssh ${SSH_OPTS} "${USER_NAME}@${DEPLOY_HOST}" "hostname && pwd"

            ssh ${SSH_OPTS} "${USER_NAME}@${DEPLOY_HOST}" bash -s <<EOF
set -eu
cd "${DEPLOY_PATH}"

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
  echo "Docker Compose not found on tesbo" >&2
  exit 1
fi

\$COMPOSE down
\$COMPOSE up --build -d

sleep 15
\$COMPOSE ps
curl -fsS "http://127.0.0.1:1011/health" || curl -fsS "http://127.0.0.1:7000/health" || true
echo "==> Deploy finished on tesbo"
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
Setup checklist on testman Jenkins:
  1) Credential ID tesbo-deploy-ssh (SSH key that can: ssh root@tesbo)
  2) Build params: DEPLOY_MODE=ssh, DEPLOY_HOST=tesbo
  3) On testman shell, verify: ssh root@tesbo hostname
"""
    }
  }
}
