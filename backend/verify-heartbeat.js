const { WebhookQueue } = require('./src/services/queue');
const assert = require('assert');

// Mock response object for SSE
class MockResponse {
  constructor(id) {
    this.id = id;
    this.data = [];
    this.ended = false;
  }

  write(chunk) {
    this.data.push(chunk);
    console.log(`[MockResponse ${this.id}] Received: ${chunk.trim()}`);
  }

  end() {
    this.ended = true;
    console.log(`[MockResponse ${this.id}] Connection ended`);
  }
}

async function runTest() {
  console.log('🧪 Starting Heartbeat Verification Test...');
  
  const queue = new WebhookQueue();
  
  // Set up a mock processor that simulates long running task
  queue.setProcessor(async (job) => {
    console.log(`[Processor] Starting job ${job.id}`);
    
    // Simulate steps
    await new Promise(r => setTimeout(r, 100));
    queue.sendProgress(job.id, { stage: 'step1', percent: 25 });
    
    await new Promise(r => setTimeout(r, 100));
    queue.sendProgress(job.id, { stage: 'step2', percent: 50 });
    
    await new Promise(r => setTimeout(r, 100));
    queue.sendProgress(job.id, { stage: 'step3', percent: 75 });
    
    await new Promise(r => setTimeout(r, 100));
    return { success: true };
  });

  // 1. Enqueue a job
  const jobId = queue.enqueue({ type: 'test_job' });
  console.log(`[Test] Job enqueued: ${jobId}`);

  // 2. Add SSE listener
  const mockRes = new MockResponse('client1');
  queue.addProgressListener(jobId, mockRes);
  console.log('[Test] Added progress listener');

  // 3. Wait for processing to complete
  // The queue processes immediately upon enqueue due to calling .process()
  
  // Wait enough time for job to finish
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 4. Verification
  console.log('\n🔍 Verifying results...');

  // Check job status in history
  const historyJob = queue.getJob(jobId);
  console.log(`[Verification] Job status in history: ${historyJob ? historyJob.status : 'NOT FOUND'}`);
  
  assert.ok(historyJob, 'Job should be in history');
  assert.strictEqual(historyJob.status, 'completed', 'Job status should be completed');
  
  // Check progress events received by listener
  const progressEvents = mockRes.data.filter(d => d.startsWith('data: ')).map(d => JSON.parse(d.substring(6)));
  console.log(`[Verification] Progress events received: ${progressEvents.length}`);
  
  assert.ok(progressEvents.length >= 3, 'Should receive at least 3 progress updates');
  assert.strictEqual(progressEvents[0].stage, 'step1', 'First stage should be step1');
  assert.strictEqual(progressEvents[progressEvents.length - 1].stage, 'complete', 'Last event should be completion');

  console.log('\n✅ Heartbeat verification PASSED!');
}

runTest().catch(console.error);
