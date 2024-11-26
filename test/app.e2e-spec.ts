import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseModule } from '@nestjs/mongoose';
import { Connection, connect } from 'mongoose';

describe('Burritos E2E Tests with Mocked DB', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer;
  let mongoConnection: Connection;

  beforeAll(async () => {
    // Inicia un servidor MongoDB en memoria
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Configura el módulo de pruebas para usar la URI en memoria
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(mongoUri), AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Conexión manual para limpiar la base de datos entre pruebas
    mongoConnection = (await connect(mongoUri)).connection;
  });

  afterEach(async () => {
    // Limpia todas las colecciones después de cada prueba
    const collections = mongoConnection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  afterAll(async () => {
    // Cierra la conexión y detiene el servidor en memoria
    await mongoConnection.close();
    await mongoServer.stop();
    await app.close();
  });

  it('Debe crear usuarios automáticamente cuando se dan burritos', async () => {
    const giverId = 'U12345';
    const receiverId = 'U67890';

    const response = await request(app.getHttpServer())
      .post('/burritos/give')
      .send({ giverId, receiverId });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      giverId,
      receiverId,
    });

    const usersResponse = await request(app.getHttpServer()).get('/users');
    expect(usersResponse.status).toBe(200);
    expect(usersResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slackId: giverId, burritosGiven: 1 }),
        expect.objectContaining({ slackId: receiverId, burritosReceived: 1 }),
      ]),
    );
  });

  it('Debe devolver el leaderboard correctamente', async () => {
    const giverId = 'U12346';
    const receiverId = 'U67891';

    // Envía algunos burritos
    await request(app.getHttpServer())
      .post('/burritos/give')
      .send({ giverId, receiverId });

    const response = await request(app.getHttpServer()).get(
      '/burritos/leaderboard',
    );
    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toHaveProperty('burritosReceived', 1);
  });

  it('Debe devolver un error si el usuario intenta darse un burrito a sí mismo', async () => {
    const giverId = 'U12345';
    const receiverId = 'U12345';

    const response = await request(app.getHttpServer())
      .post('/burritos/give')
      .send({ giverId, receiverId, message: 'Intento fallido' });

    expect(response.status).toBe(422);
    expect(response.body).toHaveProperty(
      'message',
      'No puedes darte un burrito a ti mismo.',
    );
  });
});
