# Továrna na Android: JDK 21 + Android SDK (API 36) + Node 22. Obecná pro Capacitor hry 3R Studia.
# Sestavení obrazu (na serveru): docker build -t 3r-android-builder:36 scripts/android
FROM node:22-bookworm-slim AS node

FROM eclipse-temurin:21-jdk-noble
COPY --from=node /usr/local /usr/local
ENV ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk \
    GRADLE_OPTS="-Dorg.gradle.daemon=false -Dorg.gradle.jvmargs=-Xmx1536m -Dorg.gradle.workers.max=2"
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/build-tools/36.0.0:$ANDROID_HOME/platform-tools
RUN apt-get update && apt-get install -y --no-install-recommends unzip git ca-certificates curl \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p $ANDROID_HOME/cmdline-tools \
 && curl -fsSL -o /tmp/clt.zip https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip \
 && unzip -q /tmp/clt.zip -d $ANDROID_HOME/cmdline-tools && mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest \
 && rm /tmp/clt.zip \
 && yes | sdkmanager --licenses >/dev/null \
 && sdkmanager --install "platform-tools" "platforms;android-36" "build-tools;36.0.0" >/dev/null \
 && node --version && java -version
# Android Gradle Plugin si sám bere build-tools 35 → přibalit, ať se nestahují při každém sestavení
RUN sdkmanager --install "build-tools;35.0.0" >/dev/null
WORKDIR /src
