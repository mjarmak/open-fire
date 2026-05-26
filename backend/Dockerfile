FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /workspace

COPY backend/pom.xml ./pom.xml
RUN mvn -B dependency:go-offline

COPY backend/src ./src
RUN mvn -B package -DskipTests

FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

COPY --from=build /workspace/target/*.jar /app/app.jar

USER app

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
