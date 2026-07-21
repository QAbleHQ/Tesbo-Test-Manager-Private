// Auto-deploy on main + SonarQube scan before deploy.
// Sonar secrets: Jenkins Managed file id = tesbo-test-manager-env
 //   (SONAR_HOST_URL, SONAR_TOKEN) — do not put token in git.
 // Deploy/smoke unchanged. Never: docker compose down -v

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
          echo "Pipeline ${env.GIT_SHA} → deploy ${env.DEPLOY_USER}@${env.DEPLOY_HOST}:${env.DEPLOY_PATH}"
        }
      }
    }

    stage('SonarQube') {
      steps {
        configFileProvider([
          configFile(fileId: 'tesbo-test-manager-env', variable: 'TESBO_ENV_FILE')
        ]) {
          sh '''
            set -eu
            # Load SONAR_HOST_URL + SONAR_TOKEN from Jenkins managed file (not from git)
            set -a
            # shellcheck disable=SC1090
            . "$TESBO_ENV_FILE"
            set +a

            test -n "${SONAR_HOST_URL:-}" || { echo "SONAR_HOST_URL missing in tesbo-test-manager-env"; exit 1; }
            test -n "${SONAR_TOKEN:-}" || { echo "SONAR_TOKEN missing in tesbo-test-manager-env"; exit 1; }

            echo "==> SonarQube scan → ${SONAR_HOST_URL}"
            docker run --rm \
              -e SONAR_HOST_URL="${SONAR_HOST_URL}" \
              -e SONAR_TOKEN="${SONAR_TOKEN}" \
              -v "${WORKSPACE}:/usr/src" \
              -w /usr/src \
              sonarsource/sonar-scanner-cli:11 \
              -Dsonar.projectBaseDir=/usr/src
          '''
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
      echo "OK: ${env.GIT_SHA} Sonar + deploy → https://app.tesbo.io/projects"
    }
    failure {
      echo "Failed. If Sonar stage failed, check SONAR_HOST_URL/SONAR_TOKEN in managed file tesbo-test-manager-env. Deploy unchanged otherwise."
    }
  }
}
