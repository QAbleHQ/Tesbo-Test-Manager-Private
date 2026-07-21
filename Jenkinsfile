// Auto-deploy Tesbo Test Manager (Private) on pushes to main.
//
// Architecture:
 //   Jenkins (testman:8081) → ssh tesbo → docker compose deploy
 //
 // No Jenkins SSH credential needed.
 // Uses the OS SSH config/keys already on testman (same as: ssh tesbo).
 //
 // IMPORTANT: Jenkins runs as user "jenkins" (not root).
 // On testman, one-time setup if needed:
 //   sudo -u jenkins ssh -o StrictHostKeyChecking=accept-new tesbo hostname
 // If that fails, copy root's tesbo key/config for the jenkins user:
 //   sudo mkdir -p /var/lib/jenkins/.ssh
 //   sudo cp /root/.ssh/id_rsa /root/.ssh/id_rsa.pub /root/.ssh/config /var/lib/jenkins/.ssh/ 2>/dev/null || true
 //   sudo cp /root/.ssh/known_hosts /var/lib/jenkins/.ssh/ 2>/dev/null || true
 //   sudo chown -R jenkins:jenkins /var/lib/jenkins/.ssh
 //   sudo chmod 700 /var/lib/jenkins/.ssh
 //   sudo chmod 600 /var/lib/jenkins/.ssh/id_rsa /var/lib/jenkins/.ssh/config
 //
 // Safety: never runs `docker compose down -v` (keeps Postgres data).

pipeline {
  agent any

  parameters {
    string(
      name: 'DEPLOY_HOST',
      defaultValue: 'tesbo',
      description: 'SSH host alias from testman (default: tesbo).'
    )
    string(
      name: 'DEPLOY_USER',
      defaultValue: 'root',
      description: 'SSH user on tesbo.'
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
    DEPLOY_HOST = "${params.DEPLOY_HOST?.trim() ? params.DEPLOY_HOST : 'tesbo'}"
    DEPLOY_USER = "${params.DEPLOY_USER?.trim() ? params.DEPLOY_USER : 'root'}"
    DEPLOY_PATH = "${params.DEPLOY_PATH?.trim() ? params.DEPLOY_PATH : '/opt/tesbo-test-manager/Tesbo-Test-Manager'}"
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
          echo "Deploying commit ${env.GIT_SHA}"
          echo "Using system SSH: ${env.DEPLOY_USER}@${env.DEPLOY_HOST} (no Jenkins credential)"
        }
      }
    }

    stage('Deploy via ssh tesbo') {
      when {
        anyOf {
          branch 'main'
          expression { env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' || env.GIT_BRANCH == 'main' }
        }
      }
      steps {
        sh '''
          set -eu

          SSH_OPTS="-o BatchMode=yes -o StrictHostKeyChecking=accept-new"

          echo "==> Who am I on testman?"
          whoami
          id

          echo "==> Testing SSH to ${DEPLOY_USER}@${DEPLOY_HOST}"
          ssh ${SSH_OPTS} "${DEPLOY_USER}@${DEPLOY_HOST}" "hostname && pwd"

          echo "==> Deploying commit ${GIT_SHA} on tesbo"
          ssh ${SSH_OPTS} "${DEPLOY_USER}@${DEPLOY_HOST}" bash -s <<EOF
set -eu
cd "${DEPLOY_PATH}"

echo "==> Remote / set private repo"
git remote set-url origin "${REPO_URL}"
git remote -v

echo "==> Pull latest main (DB volumes untouched)"
git fetch origin main
git checkout -f main
git reset --hard origin/main
git log -1 --oneline

echo "==> Docker Compose redeploy (NO -v)"
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
          curl -fsS -o /dev/null -w "frontend:%{http_code}\\n" "${APP_HEALTH}/login" || \
            curl -fsS -o /dev/null -w "frontend:%{http_code}\\n" "${APP_HEALTH}/" || true
          echo "Open ${APP_HEALTH}/projects"
        '''
      }
    }
  }

  post {
    success {
      echo "Deploy succeeded for ${env.GIT_SHA}. https://app.tesbo.io/projects"
    }
    failure {
      echo """
Deploy failed.
On testman, Jenkins runs as user 'jenkins'. Verify:
  sudo -u jenkins ssh tesbo hostname
If that fails, copy SSH keys from root to jenkins (see Jenkinsfile header comments).
"""
    }
  }
}
