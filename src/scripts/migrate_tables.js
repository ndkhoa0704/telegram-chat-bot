const PostgresService = require('../services/databaseService');

async function migrateTables() {
    await PostgresService.executeQuery(`
        CREATE TABLE IF NOT EXISTS public.tasks (
        id serial4 NOT NULL,
        description varchar(300) NULL,
        prompt text NULL,
        cron varchar(20) NULL,
        chat_id varchar(100) NULL,
        created_at timestamp DEFAULT now() NULL,
        updated_at timestamp DEFAULT now() NULL,
        CONSTRAINT tasks_pkey PRIMARY KEY (id)
    );`)

    await PostgresService.executeQuery(`
        CREATE TABLE IF NOT EXISTS public.conversations (
        id serial4 NOT NULL,
        chat_id varchar(100) NULL,
        messages jsonb NULL,
        summary text NULL,
        created_at timestamp DEFAULT now() NULL,
        updated_at timestamp DEFAULT now() NULL,
        CONSTRAINT conversations_pkey PRIMARY KEY (id)
        );
    `)
}

PostgresService.connect().then(async () => {
    await migrateTables();
    await PostgresService.disconnect();
});