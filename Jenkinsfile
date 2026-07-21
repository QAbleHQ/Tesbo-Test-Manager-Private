// Auto-deploy ONLY on push to main (GitHub webhook).
// testman → ssh tesbo → git pull + docker compose up --build -d
// Never: docker compose down -v

pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
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
          echo "==> Jenkins user: $(whoami)"
          ssh $SSH_OPTS "${DEPLOY_USER}@${DEPLOY_HOST}" "hostname && pwd"

          # One remote script string — no heredoc, no COMPOSE variable
          ssh $SSH_OPTS "${DEPLOY_USER}@${DEPLOY_HOST}" "
            set -e
            cd ${DEPLOY_PATH}
            git remote set-url origin ${REPO_URL}
            git fetch origin main
            git checkout -f main
            git reset --hard origin/main
            git log -1 --oneline
            docker compose down
            docker compose up --build -d
            sleep 15
            docker compose ps
            curl -fsS http://127.0.0.1:1011/health || true
            echo Deploy finished
          "
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
      echo "Auto-deploy failed. Check: ssh tesbo 'cd /opt/tesbo-test-manager/Tesbo-Test-Manager && docker compose ps'"
    }
  }
}
