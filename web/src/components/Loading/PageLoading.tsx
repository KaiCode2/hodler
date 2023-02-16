import React, { useState, useEffect } from 'react';
import Router from 'next/router';
import { Loading } from './Loading';

function PageLoading(): JSX.Element {
    const [isPageLoading, setLoading] = useState(false);
    useEffect(() => {
        // TODO: Create custom page load animations
        Router.events.on('routeChangeStart', () => setLoading(true));
        Router.events.on('routeChangeComplete', () => setLoading(false));
        Router.events.on('routeChangeError', () => setLoading(false));
    }, []);

    return (
        <div className={`transition-all ${isPageLoading ? 'translate-x-0' : 'translate-x-20'} fixed bottom-5 right-5 z-10 scale-150`} title="Loading Page">
            {isPageLoading && <Loading className={``} />}
        </div>
    );
}

export { PageLoading };
