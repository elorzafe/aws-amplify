import 'regenerator-runtime/runtime';
import React, { Component } from 'react';
import { parse } from 'graphql/language/parser';

import { API } from "aws-amplify";

const getOperationType = operation => {
    const doc = parse(operation);
    const { definitions: [{ operation: operationType },] } = doc

    return operationType;
}

export default class Connect extends Component {

    constructor(props) {
        super(props);

        this.state = this.getInitialState();
        this.subSubscription = null;
    }

    getInitialState() {
        const { query } = this.props;
        return {
            loading: query && !!query.query,
            data: {},
            errors: [],
            mutation: () => console.warn('Not implemented'),
        };
    }

    getDefaultState() {
        return {
            loading: false,
            data: {},
            errors: [],
            mutation: () => console.warn('Not implemented'),
        };
    }

    async _fetchData() {
        this._unsubscribe();
        this.setState({ loading: true });

        const {
            query: { query, variables = {}, authMode } = {},
            mutation: { query: mutation, authMode: mutationAuthMode } = {},
            subscription,
            onSubscriptionMsg = (prevData) => prevData,
        } = this.props;

        let { data, mutation: mutationProp, errors } = this.getDefaultState();

        const hasValidQuery = query && getOperationType(query) === 'query';
        const hasValidMutation = mutation && getOperationType(mutation) === 'mutation';
        const hasValidSubscription = subscription && getOperationType(subscription.query) === 'subscription';

        if (!hasValidQuery && !hasValidMutation && !hasValidSubscription) {
            console.warn('No query, mutation or subscription was specified');
        }

        if (hasValidQuery) {
            try {
                data = null;

                const response = await API.graphql({ query, variables, authMode });

                data = response.data;
            } catch (err) {
                data = err.data;
                errors = err.errors;
            }
        }

        if (hasValidMutation) {
            mutationProp = async (variables) => {
                const result = await API.graphql({ query: mutation, variables, authMode: mutationAuthMode });

                this.forceUpdate();
                return result;
            };
        }

        if (hasValidSubscription) {
            const { query: subsQuery, variables: subsVars, authMode: subsAuthMode } = subscription;

            try {
                const observable = API.graphql({ query: subsQuery, variables: subsVars, authMode: subsAuthMode });

                this.subSubscription = observable.subscribe({
                    next: ({ value: { data } }) => {
                        const { data: prevData } = this.state;
                        const newData = onSubscriptionMsg(prevData, data);
                        this.setState({ data: newData });
                    },
                    error: err => console.error(err),
                });
            } catch (err) {
                errors = err.errors;
            }
        }

        this.setState({ data, errors, mutation: mutationProp, loading: false });
    }

    _unsubscribe() {
        if (this.subSubscription) {
            this.subSubscription.unsubscribe();
        };
    }

    async componentDidMount() {
        this._fetchData();
    }

    componentWillUnmount() {
        this._unsubscribe();
    }

    componentDidUpdate(prevProps) {
        const { loading } = this.state;

        const { query: newQueryObj, subscription: newSubscriptionObj } = this.props;
        const { query: prevQueryObj, subscription: prevSubscriptionObj } = prevProps;

        // query
        const { query: newQuery, variables: newQueryVariables, authMode: newQueryAuthMode } = newQueryObj || {};
        const { query: prevQuery, variables: prevQueryVariables, authMode: prevQueryAuthMode } = prevQueryObj || {};
        const queryChanged =
            prevQuery !== newQuery || JSON.stringify(prevQueryVariables) !== JSON.stringify(newQueryVariables) ||
            newQueryAuthMode !== prevQueryAuthMode;

        // subscription
        const { query: newSubscription, variables: newSubscriptionVariables, authMode: newSubscriptionAuthMode } =
            newSubscriptionObj || {};
        const { query: prevSubscription, variables: prevSubscriptionVariables, authMode: prevSubscriptionAuthMode } =
            prevSubscriptionObj || {};
        const subscriptionChanged =
            prevSubscription !== newSubscription
            || JSON.stringify(prevSubscriptionVariables) !== JSON.stringify(newSubscriptionVariables) ||
            newSubscriptionAuthMode !== prevSubscriptionAuthMode;

        if (!loading && (queryChanged || subscriptionChanged)) {
            this._fetchData();
        }
    }

    render() {
        const { data, loading, mutation, errors } = this.state;

        return this.props.children({ data, errors, loading, mutation }) || null;
    }
}
