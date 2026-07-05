package worker

import (
	"context"
	"errors"
	"log"
	"sync"
	"time"

	"imagen/backend/internal/service"
)

type Pool struct {
	app         *service.App
	concurrency int
	cancel      context.CancelFunc
	wg          sync.WaitGroup
}

func NewPool(app *service.App, concurrency int) *Pool {
	if concurrency <= 0 {
		concurrency = 1
	}
	if concurrency > 50 {
		concurrency = 50
	}
	return &Pool{app: app, concurrency: concurrency}
}

func (p *Pool) Start(parent context.Context) {
	ctx, cancel := context.WithCancel(parent)
	p.cancel = cancel
	for i := 0; i < p.concurrency; i++ {
		p.wg.Add(1)
		go p.loop(ctx, i+1)
	}
}

func (p *Pool) Stop() {
	if p.cancel != nil {
		p.cancel()
	}
	p.wg.Wait()
}

func (p *Pool) loop(ctx context.Context, workerID int) {
	defer p.wg.Done()
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}
		task, ok, err := p.app.ClaimQueuedTask(ctx)
		if err != nil {
			log.Printf("worker %d claim failed: %v", workerID, err)
			time.Sleep(2 * time.Second)
			continue
		}
		if !ok {
			time.Sleep(1 * time.Second)
			continue
		}
		log.Printf("worker %d running task %s", workerID, task.ID)
		err = p.app.RunTask(ctx, task)
		if err != nil {
			if errors.Is(err, service.ErrNoProviderAccount) {
				log.Printf("worker %d task %s waiting for provider account", workerID, task.ID)
				time.Sleep(5 * time.Second)
				continue
			}
			log.Printf("worker %d task %s failed: %v", workerID, task.ID, err)
		}
	}
}
