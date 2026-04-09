jest.mock("socket.io", () => {
    const ioMock = {
        on: jest.fn(),
        emit: jest.fn(),
        close: jest.fn(),
        to: jest.fn(() => ({ emit: jest.fn() })),
    };

    return {
        Server: jest.fn(() => ioMock),
        __ioMock: ioMock,
    };
});

const { EventEmitter } = require("events");
const { __ioMock } = require("socket.io");
const SocketGateway = require("./SocketGateway");

describe("SocketGateway", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        __ioMock.emit.mockClear();
        __ioMock.on.mockClear();
        __ioMock.to.mockClear();
        __ioMock.close.mockClear();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test("emits alert:new with payload and pushes metrics every 5 seconds", async () => {
        const emitter = new EventEmitter();
        const alertModel = {
            aggregate: jest
                .fn()
                .mockResolvedValueOnce([{ _id: "HIGH", count: 2 }])
                .mockResolvedValueOnce([{ _id: { hour: "2026-01-01T01:00:00Z" }, count: 2 }]),
        };

        const gateway = new SocketGateway({
            httpServer: {},
            emitter,
            alertModel,
            sarQueue: { getDepth: () => 3 },
            logger: { error: jest.fn() },
        });

        gateway.start();

        const payload = {
            alert_id: "a1",
            edge: {
                from: "A",
                to: "B",
                amount: 2000,
                timestamp: new Date().toISOString(),
                txId: "tx-1",
            },
        };

        emitter.emit("alert:new", payload);
        expect(__ioMock.emit).toHaveBeenCalledWith("alert:new", payload);

        await jest.advanceTimersByTimeAsync(5000);

        expect(__ioMock.emit).toHaveBeenCalledWith(
            "metrics:update",
            expect.objectContaining({
                tps: expect.any(Number),
                alertCounts: expect.objectContaining({ HIGH: 2 }),
                sarQueueDepth: 3,
            })
        );

        gateway.stop();
        expect(__ioMock.close).toHaveBeenCalled();
    });
});
